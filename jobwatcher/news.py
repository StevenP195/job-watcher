"""News tab: recent headlines about each watched employer, with interview prep.

    python -m jobwatcher news

1. For each employer, read two Google News RSS searches (last 21 days): the
   company in general (national news) and the company + Houston (local news).
2. Keep up to 8 headlines per employer, Houston headlines first.
3. Headlines that are new since the last run get a short summary from the
   Claude API (with web search, so it reads the actual coverage): what happened,
   why it matters for this role, and how to bring it up in an interview.
   Summaries are saved, so each headline is summarized once.
   Without ANTHROPIC_API_KEY the step still runs: headlines are saved with
   interview tips based on the company type instead of an AI summary.
4. Writes data/news.json, which news.html reads in the browser.

This step is separate from the job pipeline: if it fails, the job data,
history and status files are not affected.
"""

import datetime as dt
import email.utils
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

from . import config

WINDOW_DAYS = 21
PER_COMPANY = 8
UA = {"User-Agent": "Mozilla/5.0 (compatible; job-watcher class project)"}

ROLE = ("an entry-level credit analyst, commercial / corporate banking analyst, or "
        "investment banking / M&A analyst candidate based in Houston, Texas, graduating "
        "with an MS in Finance in May 2027, with buy-side M&A and Houston energy internship experience")

TIPS = {
    "bank": {
        "why": "Bank news shapes lending appetite, credit quality and where the bank is hiring. "
               "Deals, earnings, new markets and leadership changes all affect a credit or banking analyst's day-to-day work.",
        "interview": "Mention it briefly when asked why this bank: say what you read, then ask how it affects the "
                     "commercial or energy lending team's growth plans in Houston.",
    },
    "ib": {
        "why": "Deal announcements, league-table moves and senior hires show which sectors the bank is winning in, "
               "and which groups are busy enough to need analysts.",
        "interview": "Use it as a 'recent deal or news' talking point: name the transaction or hire, why it matters "
                     "for the sector, and ask how the Houston energy team is positioned.",
    },
    "energy": {
        "why": "For an energy company, news on projects, contracts, commodity prices and counterparties drives "
               "credit risk and trade-finance work, which is the work a credit or treasury analyst does.",
        "interview": "Connect it to credit: how the news changes counterparty exposure, liquidity or financing "
                     "needs, and tie it to your Houston energy internship experience.",
    },
}

SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summaries": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "what": {"type": "string"},
                    "why": {"type": "string"},
                    "interview": {"type": "string"},
                },
                "required": ["id", "what", "why", "interview"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["summaries"],
    "additionalProperties": False,
}


# ---------------------------------------------------------------- headlines

def rss_url(query):
    q = urllib.parse.quote_plus(f"{query} when:{WINDOW_DAYS}d")
    return f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"


def parse_rss(xml_text):
    items = []
    root = ET.fromstring(xml_text)
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        source = (it.findtext("source") or "").strip()
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3].strip()
        try:
            published = email.utils.parsedate_to_datetime(it.findtext("pubDate")).astimezone(dt.timezone.utc)
        except (TypeError, ValueError):
            continue
        items.append({"title": title, "url": (it.findtext("link") or "").strip(),
                      "source": source, "published": published.isoformat().replace("+00:00", "Z")})
    return items


def fetch_rss(query):
    req = urllib.request.Request(rss_url(query), headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return parse_rss(r.read().decode("utf-8", "replace"))


# Headlines that mention the name but are not news about the firm: venues named
# after a bank, sports, concerts, stock-quote pages, and analyst ratings on other companies.
NOISE = re.compile(
    r"\barena\b|\bstadium\b|\bfield\b|\bamphitheat|\bconcert|\btour\b|\btickets?\b|\bgame\b|\bvs\.?\b"
    r"|\bnfl\b|\bnba\b|\bbrowns\b|\bspurs\b|\bplayoff|\bfestival|\bshow\b"
    r"|stock price|price target|\brating\b|\breaffirms\b|\bmaintains\b|\breiterat|\binitiates? coverage"
    r"|\boverweight\b|\bunderweight\b|\boutperform|\bneutral\b|\bupgrade[sd]?\b|\bdowngrade[sd]?\b"
    r"|shares (sold|bought|acquired)|\bstake in\b|position in|\bholdings? in\b|\b13f\b|news & analysis"
    r"|\bobituar|(purchased|bought|sold|acquired|boosted|trimmed|lowered|raised) by\b|newly purchased"
    r"|stock analysis|stock forecast|ex-dividend|\blogin\b|xstock|bullish or bearish|undervalued|overvalued"
    r"|covered by analysts|top pick|\btarget\b|to present at|conference|\bbirdie\b|\beagles?\b|\bgolf"
    r"|cramer|stocks to consider|should you buy|buy or sell|price prediction|dividend stock|\bscam\b"
    r"|[\d,]+ shares|share price|\bpark\b|championship|cd rates|robbery|depositary|fund update|position opened"
    r"|\binsider\b|income statement|\bdividends\b|return on assets|sec form|\bput options|\bcall options"
    r"|net (sellers|buyers)|zacks|\bpt\b|analyst says|\bwarns\b|narrative|bull case|bear case"
    r"|investors are reacting|something to think about|getting attention|stock traders|\bholdings entries"
    r"|holding (entry|entries|worth)|seasonal returns|\b13g\b|shareholding|stock up \d|stock down \d|return shares to",
    re.I,
)


def is_noise(title):
    return bool(NOISE.search(title))


def names_firm(title, key):
    t = title.lower()
    return any(a in t for a in config.NEWS_ALIASES.get(key, []))


def norm_title(t):
    return re.sub(r"[^a-z0-9 ]", "", t.lower())[:90]


STOP = set("a an the to of in on for and with at by from as its is are be after over into new says inc corp co".split())


def words(t):
    out = set()
    for w in norm_title(t).split():
        w = re.sub(r"^(\d+)(b|bn|m|mn|k)$", r"\1", w)  # "32b", "32bn" -> "32" (from "$3.2B")
        if w not in STOP and len(w) > 1:
            out.add(w)
    return out


GENERIC = set("""acquisition acquire acquires acquired agrees billion million trillion quarter quarterly
earnings results report reports announces announced financial shares stock stocks growth expands expand
senior market markets capital deal deals merger merge bank banks banking business services holdings
company companies energy group strategic platform completes complete appoints names director officer
outlook profit revenue record higher lower prices pricing offering notes""".split())


def same_story(a, b, firm_words):
    """Two headlines about one event: they share an uncommon word (a name such as
    'Trustmark') or several key words."""
    wa, wb = words(a) - firm_words, words(b) - firm_words
    shared = wa & wb
    if len(shared) >= 3 or (wa and wb and len(shared) / min(len(wa), len(wb)) >= 0.5):
        return True
    return any((len(w) >= 6 and w not in GENERIC and not w.isdigit()) or (w.isdigit() and len(w) >= 2 and w not in ("2026", "2027"))
               for w in shared)


def headlines_for(cfg, now):
    query, category = config.NEWS_QUERIES[cfg["key"]]
    national = fetch_rss(query)
    local = fetch_rss(f"({query}) Houston")
    cutoff = now - dt.timedelta(days=WINDOW_DAYS)
    firm_words = set().union(*(words(a) for a in config.NEWS_ALIASES.get(cfg["key"], [""])))
    seen, out = set(), []
    for scope, items in (("houston", local), ("national", national)):
        for it in items:
            key = norm_title(it["title"])
            when = dt.datetime.fromisoformat(it["published"].replace("Z", "+00:00"))
            if (key in seen or when < cutoff or not it["title"] or is_noise(it["title"])
                    or not names_firm(it["title"], cfg["key"])
                    or any(same_story(it["title"], o["title"], firm_words) for o in out)):
                continue
            seen.add(key)
            is_local = scope == "houston" or "houston" in it["title"].lower()
            out.append({**it, "id": hashlib.sha1(key.encode()).hexdigest()[:12],
                        "company": cfg["key"], "employer": cfg["employer"], "category": category,
                        "scope": "houston" if is_local else "national"})
    # up to 4 Houston headlines first, then the newest national ones
    houston = sorted([x for x in out if x["scope"] == "houston"], key=lambda x: x["published"], reverse=True)
    national = sorted([x for x in out if x["scope"] == "national"], key=lambda x: x["published"], reverse=True)
    return (houston[:4] + national)[:PER_COMPANY]


# ---------------------------------------------------------------- summaries

def tips(item):
    t = TIPS[item["category"]]
    return {"what": "", "why": t["why"], "interview": t["interview"], "ai": False}


def summarize(client, model, employer, items):
    """One request per employer: summaries for its new headlines, using web search."""
    listing = "\n".join(f'- id {it["id"]}: "{it["title"]}" ({it["source"]}, {it["published"][:10]})'
                        for it in items)
    prompt = (
        f"You are helping {ROLE} prepare for interviews with {employer}.\n\n"
        f"Recent headlines about {employer}:\n{listing}\n\n"
        "For each headline, search the web for the story and write three short parts:\n"
        "- what: what happened, in 2 sentences, with the key facts and numbers from the coverage.\n"
        "- why: why it matters to someone joining this firm in a credit, banking or M&A analyst seat, in 1-2 sentences.\n"
        "- interview: one concrete way to bring it up in an interview, such as a sentence to say or a question to ask, "
        "in 1-2 sentences.\n"
        "Write plain sentences without markdown or citations. If you cannot find the story, base 'what' on the "
        "headline and say the details could not be confirmed. Return one entry per id."
    )
    messages = [{"role": "user", "content": prompt}]
    for _ in range(4):  # resume server-tool turns that pause
        response = client.beta.messages.create(
            model=model,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low",
                           "format": {"type": "json_schema", "schema": SUMMARY_SCHEMA}},
            tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": min(len(items) + 1, 6)}],
            messages=messages,
        )
        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.content})
            continue
        break
    if response.stop_reason == "refusal":
        raise RuntimeError("request declined")
    text = [b.text for b in response.content if b.type == "text"]
    if not text:
        raise RuntimeError(f"no text in response (stop_reason={response.stop_reason})")
    data = json.loads(text[-1])
    return {s["id"]: {"what": s["what"].strip(), "why": s["why"].strip(),
                      "interview": s["interview"].strip(), "ai": True} for s in data["summaries"]}


def make_client():
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        return None
    import anthropic
    return anthropic.Anthropic(max_retries=3)


# ---------------------------------------------------------------- main

def run(now=None, path=config.NEWS):
    now = now or dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    old = {}
    if path.exists():
        try:
            old = {it["id"]: it for it in json.loads(path.read_text(encoding="utf-8")).get("items", [])}
        except (ValueError, KeyError):
            old = {}

    def safe(cfg):
        try:
            return cfg["key"], headlines_for(cfg, now), ""
        except Exception as e:
            return cfg["key"], [], str(e)[:200]

    with ThreadPoolExecutor(4) as ex:
        results = list(ex.map(safe, [c for c in config.SOURCES if c["key"] in config.NEWS_QUERIES]))

    items, companies = [], []
    for key, heads, err in results:
        companies.append({"key": key, "employer": config.SOURCES_BY_KEY[key]["employer"],
                          "ok": not err, "count": len(heads), "error": err})
        if err:  # keep yesterday's headlines for a company whose feed failed today
            heads = [it for it in old.values() if it["company"] == key]
        for h in heads:
            prev = old.get(h["id"])
            h["first_seen"] = prev["first_seen"] if prev else now.date().isoformat()
            h["summary"] = prev["summary"] if prev and prev.get("summary", {}).get("ai") else None
            items.append(h)

    client = make_client()
    model = os.environ.get("NEWS_MODEL", config.NEWS_MODEL)
    pending = [it for it in items if it["summary"] is None]
    summarized = 0
    if client:
        by_company = {}
        for it in sorted(pending, key=lambda x: (x["scope"] != "houston", x["published"])):
            by_company.setdefault(it["employer"], []).append(it)
        budget = config.NEWS_MAX_SUMMARIES_PER_RUN
        for employer, group in by_company.items():
            group = group[: max(0, min(4, budget))]
            if not group:
                break
            try:
                result = summarize(client, model, employer, group)
            except Exception as e:  # one failure never stops the run
                print(f"summary failed for {employer}: {e}", file=sys.stderr)
                continue
            for it in group:
                if it["id"] in result:
                    it["summary"] = result[it["id"]]
                    summarized += 1
            budget -= len(group)
    for it in items:
        if it["summary"] is None:
            it["summary"] = tips(it)

    items.sort(key=lambda x: x["published"], reverse=True)
    out = {
        "updated": now.isoformat().replace("+00:00", "Z"),
        "window_days": WINDOW_DAYS,
        "ai_summaries": bool(client),
        "model": model if client else "",
        "companies": companies,
        "items": items,
    }
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"news.json: {len(items)} headlines from {sum(c['ok'] for c in companies)}/{len(companies)} feeds; "
          f"{summarized} new AI summaries" + ("" if client else " (no ANTHROPIC_API_KEY: interview tips only)"))
    return out
