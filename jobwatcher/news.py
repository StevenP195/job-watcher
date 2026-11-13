"""News tab: recent headlines about each watched employer, with interview prep.

    python -m jobwatcher news

1. For each employer, read two Google News RSS searches (last 21 days): the
   company in general (national news) and the company + Houston (local news).
2. Keep up to 8 headlines per employer, Houston headlines first, with
   off-topic headlines filtered out and repeat coverage of one story merged.
3. Give each headline interview prep from simple rules (no paid service):
   the headline is sorted into an event type (acquisition, earnings, hire,
   debt deal, expansion, partnership, listing, ...) and the notes say what
   happened, why that kind of event matters for a credit / banking / M&A
   analyst at this firm, and how to bring it up in an interview.
4. Writes data/news.json, which news.html reads in the browser.

This step is separate from the job pipeline: if it fails, the job data,
history and status files are not affected.
"""

import datetime as dt
import email.utils
import hashlib
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

from . import config

WINDOW_DAYS = 21
PER_COMPANY = 8
UA = {"User-Agent": "Mozilla/5.0 (compatible; job-watcher class project)"}

# ---------------------------------------------------------------- interview prep (rule based)
# Each headline is matched to the first event type whose pattern it contains.
# {firm} is filled with the employer name. "why" is written for each company
# type: bank, ib (investment bank), energy.
EVENTS = [
    ("Merger or acquisition", re.compile(r"acquir|acquisition|merger|merge|\bbuys?\b|to buy|takeover|deal for|combine|\bbid", re.I), {
        "why": {
            "bank": "A bank merger changes the loan book, the credit policy and often the team structure. Analysts help "
                    "review the acquired portfolio, and the combined bank usually needs more credit capacity.",
            "ib": "Buying another advisory firm adds bankers and sector coverage, which shows where {firm} wants to grow "
                  "and which groups may be adding analysts.",
            "energy": "An acquisition changes the company's debt, liquidity and counterparty mix, which is what a credit "
                      "or treasury team watches most closely.",
        },
        "interview": "Bring it up when asked why {firm}: name the deal, say what it adds (markets, scale or sector "
                     "coverage), and ask how the integration will change the team you would join.",
    }),
    ("Earnings or results", re.compile(r"earnings|results|quarter|\bq[1-4]\b|\bprofits?\b|\blosses\b|\bloss\b|revenue|guidance|outlook", re.I), {
        "why": {
            "bank": "Quarterly results show loan growth, credit quality (charge-offs, reserves) and margin pressure, "
                    "which shape how much {firm} wants to lend and to whom.",
            "ib": "Results show which businesses (M&A advisory, capital markets, restructuring) are driving revenue, "
                  "and so which groups are busiest.",
            "energy": "Results and guidance drive cash flow, leverage and covenant headroom, the core of a credit "
                      "analyst's view of an energy company.",
        },
        "interview": "Show you follow the firm: cite one number or trend from the results and ask how it affects "
                     "the group's priorities for next year.",
    }),
    ("Senior hire or leadership change", re.compile(r"appoint|\bnames?\b|\bhires?\b|\bhired\b|\bjoins\b|promot|\bceo\b|president|\bchief\b|\bhead of\b|executive|\bsvps?\b|managing director", re.I), {
        "why": {
            "bank": "New leaders often bring new growth plans for a market or business line, and new teams to staff.",
            "ib": "Senior hires show which sectors {firm} is building out; a new managing director usually needs analysts.",
            "energy": "A leadership change can shift strategy, capital spending and financing plans.",
        },
        "interview": "Mention the new leader by name and ask what they plan to build, which shows you've researched "
                     "the team and not just the firm.",
    }),
    ("Debt or financing deal", re.compile(r"notes|bond|debt|loan|credit facility|refinanc|financing|offering|syndicat|issu", re.I), {
        "why": {
            "bank": "A financing deal shows the kind of credit {firm} underwrites and arranges, which is the analyst's core work.",
            "ib": "Debt and capital-markets deals are analyst work: models, credit memos and pitch materials.",
            "energy": "New debt changes leverage, interest cost and maturities, the first things a credit analyst checks.",
        },
        "interview": "Connect it to credit work: mention the size and terms, and how you would think about leverage "
                     "and repayment capacity, drawing on your financing-package work at Watercress.",
    }),
    ("Expansion or new office", re.compile(r"expan|new (office|branch|location|market|headquarters|hq)|\bopens?\b|\bground\b|\benters?\b|launch|growth", re.I), {
        "why": {
            "bank": "Expansion into a market means new commercial clients, and new credit analysts and portfolio managers to cover them.",
            "ib": "Expansion means new coverage and new seats on deal teams.",
            "energy": "Expansion projects need financing and create new counterparties, which is credit and treasury work.",
        },
        "interview": "Say you noticed the expansion and ask how the Houston team fits into it. It's a natural lead-in "
                     "to why you want to start your career in Houston.",
    }),
    ("Partnership or contract", re.compile(r"partner|agreement|contract|signs|teams up|alliance|selects|award", re.I), {
        "why": {
            "bank": "Partnerships show where {firm} is investing (technology, new client segments, new markets).",
            "ib": "Mandates and partnerships show {firm}'s client relationships and sector strength.",
            "energy": "Long-term contracts make cash flows more predictable, which supports credit quality and financing.",
        },
        "interview": "Use it as a 'recent news' answer: one sentence on the agreement, then why it matters for the "
                     "firm's clients or cash flows.",
    }),
    ("Stock listing or market move", re.compile(r"listing|exchange|ticker|txse|nyse|nasdaq|shares|stock|dividend|buyback", re.I), {
        "why": {
            "bank": "Market moves and listings reflect how investors see {firm}'s growth and risk, the context for its lending strategy.",
            "ib": "How the market values {firm} affects hiring budgets and deal activity.",
            "energy": "Investor sentiment affects the company's cost of capital and access to financing.",
        },
        "interview": "Mention it lightly and ask what it means for the firm's strategy in Texas; avoid stock-price "
                     "predictions.",
    }),
]
GENERAL = ("Firm news", {
    "why": {
        "bank": "News about {firm} shapes its lending appetite and where it is hiring.",
        "ib": "News about {firm} shows where its deal teams are busy.",
        "energy": "News about {firm} affects its cash flows and counterparties, the heart of credit and treasury work.",
    },
    "interview": "Have one sentence ready on this story for the 'what have you read about us lately?' question, and "
                 "follow it with a question about the team.",
})


def event_type(title):
    for name, pattern, notes in EVENTS:
        if pattern.search(title):
            return name, notes
    return GENERAL


def prep(item):
    """Interview prep for one headline, from the rules above."""
    name, notes = event_type(item["title"])
    firm = item["employer"]
    place = "Houston" if item["scope"] == "houston" else "national"
    when = dt.date.fromisoformat(item["published"][:10]).strftime("%b %d").replace(" 0", " ")
    return {
        "event": name,
        "what": f"{item['source'] or 'A news outlet'} reported on {when} ({place} coverage): \"{item['title']}\". "
                f"Read the article for the details before you bring it up.",
        "why": notes["why"][item["category"]].format(firm=firm),
        "interview": notes["interview"].format(firm=firm),
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
            h["prep"] = prep(h)
            h.pop("summary", None)
            items.append(h)

    items.sort(key=lambda x: x["published"], reverse=True)
    out = {
        "updated": now.isoformat().replace("+00:00", "Z"),
        "window_days": WINDOW_DAYS,
        "companies": companies,
        "items": items,
    }
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"news.json: {len(items)} headlines from {sum(c['ok'] for c in companies)}/{len(companies)} feeds")
    return out
