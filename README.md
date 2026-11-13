# Job Watcher — Houston credit & banking

[![Tests](https://github.com/StevenP195/job-watcher/actions/workflows/tests.yml/badge.svg)](https://github.com/StevenP195/job-watcher/actions/workflows/tests.yml)
[![Daily job watch](https://github.com/StevenP195/job-watcher/actions/workflows/daily.yml/badge.svg)](https://github.com/StevenP195/job-watcher/actions/workflows/daily.yml)

**Live site:** https://stevenp195.github.io/job-watcher/

Every day, on its own, this tool pulls the open positions at 17 Houston employers, compares them with
what it saw the day before, records what is new and what is gone, opens a GitHub Issue listing the
changes, and publishes the result to a website.

**Role:** entry-level, full-time **credit / risk analyst**, **commercial or corporate banking analyst**,
and **investment banking / M&A analyst** roles, with a focus on **Houston, TX** (energy lending, Texas
banks, middle-market investment banks, and Houston energy companies' credit and finance teams).

## Build the history file

```bash
uv run python -m jobwatcher build
```

This rebuilds `data/history.csv` and `data/status.json` from the raw files in `data/raw/` alone.
Running it again produces the same file, and a change to a rule applies to every day of the history.

Other commands:

| Command | What it does |
|---|---|
| `uv run python -m jobwatcher run` | the daily pipeline: fetch every source, build history and status, open/update today's issue |
| `uv run python -m jobwatcher fetch` | only call the sources and save `data/raw/<date>/<source>.json.gz` |
| `uv run python -m jobwatcher issue` | open or update today's GitHub issue from the current data |
| `uv run python -m jobwatcher market` | print the six Market page numbers computed in Python (cross-check for the browser) |
| `uv run python -m jobwatcher news` | refresh `data/news.json`: firm headlines and interview prep for the News page |
| `uv run python -m jobwatcher serve` | serve the site locally at http://localhost:8000 |
| `uv run pytest` | run the test suite |

## Sources

Every board returns JSON to a request made with no login; no HTML is read.

| Employer | Source name | Applicant tracking system | Endpoint |
|---|---|---|---|
| Fifth Third Bank | `fifth_third` | Workday | `fifththird.wd5` / `53careers` |
| Origin Bank | `origin_bank` | Workday | `originbank.wd1` / `Careers` |
| Huntington Bank (incl. Cadence) | `huntington` | Workday | `huntington.wd12` / `HNBcareers` |
| Regions Bank | `regions` | Workday | `regions.wd5` / `Regions_Careers` |
| Texas Capital Bank | `texas_capital` | Workday | `texascapitalbank.wd12` / `Careers` |
| Hancock Whitney | `hancock_whitney` | Workday | `hancockwhitney.wd5` / `Careers` |
| Frost Bank | `frost` | Workday | `frostbank.wd5` / `external` |
| Simmons Bank | `simmons` | Workday | `simmonsbank.wd5` / `SimmonsCareers` |
| MUFG | `mufg` | Workday | `mufgub.wd3` / `MUFG-Careers` |
| Mizuho Americas | `mizuho` | Workday | `mizuho.wd1` / `mizuhoamericas` |
| Piper Sandler | `piper_sandler` | Workday | `pipersandler.wd501` / `Piper_Sandler_Careers` |
| Houlihan Lokey | `houlihan_lokey` | Workday | `hl.wd1` / `Campus` |
| Trafigura | `trafigura` | Workday | `trafigura.wd3` / `TrafiguraCareerSite` |
| Williams Companies | `williams` | Workday | `williams.wd5` / `External` |
| Plains All American | `plains` | Workday | `plains.wd1` / `plains` |
| Engelhart | `engelhart` | Greenhouse | `boards-api.greenhouse.io/v1/boards/engelhart/jobs` |
| Cheniere Energy | `cheniere` | Oracle Recruiting Cloud | `hcgi.fa.us2.oraclecloud.com` / site `CX_2` |

**Search terms:** no board returns more than 5,000 postings (the largest, Fifth Third, lists about
1,000), so every board is requested in full with **no search term**. The `search` setting in
`jobwatcher/config.py` is there if a board grows past 5,000.

## Title rule

A posting is **in role** (`in_role = true`) when its title meets all three conditions
(`jobwatcher/title_rule.py`, case-insensitive):

1. **Area:** names credit, underwriting, risk, portfolio, lending, loan, commercial / corporate /
   energy / investment banking, IB, M&A, mergers, acquisitions, capital markets, leveraged /
   structured / project / trade finance, restructuring, or a banker development / analyst / rotational program;
2. **Level:** names analyst, associate, underwriter, program, trainee, or development;
3. **Not excluded:** does not name an internship or summer / co-op program; a senior level
   (senior, sr, lead, principal, head, VP, AVP, SVP, director, managing, officer, manager,
   supervisor, III, IV); a technology or cyber risk job; operations, servicing, onboarding, data,
   KYC, client services, administrator, third-party, financial crimes, fraud or collections work;
   or a part-time, contract or temporary job.

Location is not part of the rule. Houston is the default location filter on the Browse page and the
first section of the daily issue.

## News page (extra)

`news.html` lists recent headlines about every watched employer, from two Google News searches per
employer over the last 21 days: the firm in general (national) and the firm plus "Houston" (local).
Headlines that don't name the firm, venue and sports stories (such as "Fifth Third Park"), stock-quote
pages and fund-holdings filings are filtered out, and several headlines about one event are merged into one.

Clicking a headline shows **what happened**, **why it's relevant** to a credit, banking or M&A analyst,
and **how to bring it up in an interview**. These notes come from simple rules in `jobwatcher/news.py`
at no cost (no paid API): each headline is sorted into an event type (merger or acquisition, earnings,
senior hire, debt or financing deal, expansion, partnership, stock listing, or general firm news), and the
notes explain why that kind of event matters for a credit, banking or M&A analyst at that type of firm
(bank, investment bank, or energy company), with a suggested way to raise it in an interview.

The news step runs after the job pipeline with `continue-on-error`, so it can never cause a failed daily run.

## Design

A clean finance dashboard in a winter palette: a blue-to-white header with falling snow (white flakes
and green flecks), and a night scene at the bottom of every page, with a swirling starry sky, pines, a
deer, a little tree and a polar bear with cocoa above a knit-sweater border. Hovering (or tapping) the scene lights
the tree and writes a note in cursive: *"Remember no man is a failure who has friends. Thanks for the
wings! Love, Clarence."* Clicking the little tree shakes the snow off its branches. All artwork is
original SVG drawn in `assets/winter.js`; the cursive font is Homemade Apple from Google Fonts.

## How it works

**Daily run** (`.github/workflows/daily.yml`, 11:17 UTC):

1. Calls every source and saves what it returns, compressed, to `data/raw/<date>/<source>.json.gz`.
   One failing source does not stop the run; it writes no raw file that day, and every source's
   result (ok, count, error) is recorded in `data/runs/<date>.json`.
2. Rebuilds `data/history.csv` from all raw files.
3. Writes `data/status.json`.
4. Opens a GitHub Issue titled with the date listing new and removed postings (Houston in-role first),
   each with a link, mentions the owner so GitHub sends a notification, and closes the previous
   day's issue. The issue is opened every day, even with no changes.
5. Commits the raw files, run record, history and status, then republishes the site.

A second run on the same day replaces that day's raw files, rebuilds the history, and edits that
day's issue, so each day counts once. Dates are UTC.

**History rules** (`jobwatcher/history.py`), day by day: a posting seen for the first time gets that
day as `first_seen` (`first_run = true` if it was in its source's first raw file); every posting its
source lists that day gets that day as `last_seen`; an open posting is marked `removed` with that
day's `removed_date` when its source has a raw file that day and no longer lists it; a removed posting
listed again re-opens with `removed_date` cleared and `first_seen` unchanged. Rows are sorted by
`posting_id` (`<source>:<source's own id>`).

## Files

| Path | What it does |
|---|---|
| `README.md` | this file |
| `pyproject.toml`, `uv.lock` | Python project and locked dev dependency (pytest); the pipeline uses only the standard library |
| `.gitignore`, `.gitattributes` | ignored files; LF line endings so the history file is byte-identical on every OS |
| `jobwatcher/__main__.py` | command line: `run`, `fetch`, `build`, `issue`, `market`, `serve` |
| `jobwatcher/config.py` | watch list (employers, ATS, endpoints), file paths, history columns |
| `jobwatcher/http.py` | JSON request helper with retries |
| `jobwatcher/ats/__init__.py` | adapter registry and the common column set |
| `jobwatcher/ats/workday.py` | Workday: paged fetch, detail lookup for multi-location postings, conversion |
| `jobwatcher/ats/greenhouse.py` | Greenhouse: fetch and conversion |
| `jobwatcher/ats/oracle.py` | Oracle Recruiting Cloud: paged fetch and conversion |
| `jobwatcher/fetch.py` | calls every source, writes raw files and the per-source run record |
| `jobwatcher/title_rule.py` | the title rule (`in_role`) |
| `jobwatcher/history.py` | builds `data/history.csv` from the raw files |
| `jobwatcher/status.py` | builds `data/status.json` |
| `jobwatcher/issues.py` | renders and publishes the daily GitHub Issue |
| `jobwatcher/market.py` | the six Market numbers in Python, to cross-check the page |
| `jobwatcher/news.py` | News page data: Google News headlines, filters, rule-based interview prep |
| `tests/test_news.py` | news parsing, filters, story merging, and interview-prep rules |
| `tests/conftest.py` | fixture that writes raw files like the fetch step |
| `tests/test_sources.py` | conversion of each source type to the common columns |
| `tests/test_title_rule.py` | title rule cases |
| `tests/test_history.py` | first-seen, last-seen, removed, re-open, failed-source, reproducibility, status counts |
| `.github/workflows/daily.yml` | daily schedule: tests, pipeline, issue, news, commit, publish |
| `.github/workflows/tests.yml` | runs pytest on every push |
| `.github/workflows/pages.yml` | publishes the site (pages, assets, history and status) to GitHub Pages |
| `index.html` + `assets/today.js` | **Today** page: last run, source status, the four counts, new and removed lists |
| `browse.html` + `assets/browse.js` | **Browse** page: role switch, employer / location / days-open filters, title search, first-seen sort, apply links, starred shortlist (saved in the browser) |
| `market.html` + `assets/market.js` | **Market** page: six findings with charts, computed in the browser from `history.csv` |
| `news.html` + `assets/news.js` | **News** page: firm headlines (Houston and national), click for what happened / why it matters / how to bring it up |
| `assets/winter.js` | falling snow and the interactive night scene with Clarence's note (original SVG art) |
| `assets/app.js` | shared navigation bar, theme, data loading, CSV parser, helpers, service worker registration |
| `assets/style.css` | shared fonts and colors (winter finance dashboard, light and dark) |
| `assets/vendor/chart.umd.min.js` | Chart.js 4.4.1, stored locally so charts work offline |
| `assets/icons/*.png` | app icons |
| `manifest.webmanifest` | web app manifest (installable) |
| `sw.js` | service worker: network first, last loaded data when offline |
| `scripts/make_icons.py` | draws the app icons |
| `data/raw/<date>/<source>.json.gz` | what each source returned that day |
| `data/runs/<date>.json` | result of every source in that day's run (ok, count, error) |
| `data/history.csv` | one row per posting (fixed path) |
| `data/status.json` | the latest run (fixed path) |
| `data/news.json` | News page headlines and interview prep |
