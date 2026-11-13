"""Watch list: every employer, the applicant tracking system that hosts its board,
and the settings needed to call that board's public JSON endpoint."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
RUNS = DATA / "runs"
HISTORY = DATA / "history.csv"
STATUS = DATA / "status.json"

# GitHub account mentioned in each daily issue so GitHub sends a notification.
NOTIFY_USER = "StevenP195"

# key: the source name used in file names and posting_id.
# search: optional search term (required by the assignment only for boards with
# more than 5,000 postings; none of these boards are that large today).
SOURCES = [
    # --- Texas and regional banks: credit analyst / banker development ---
    {"key": "fifth_third", "employer": "Fifth Third Bank", "ats": "workday",
     "tenant": "fifththird", "wd": 5, "site": "53careers"},
    {"key": "origin_bank", "employer": "Origin Bank", "ats": "workday",
     "tenant": "originbank", "wd": 1, "site": "Careers"},
    {"key": "huntington", "employer": "Huntington Bank (incl. Cadence)", "ats": "workday",
     "tenant": "huntington", "wd": 12, "site": "HNBcareers"},
    {"key": "regions", "employer": "Regions Bank", "ats": "workday",
     "tenant": "regions", "wd": 5, "site": "Regions_Careers"},
    {"key": "texas_capital", "employer": "Texas Capital Bank", "ats": "workday",
     "tenant": "texascapitalbank", "wd": 12, "site": "Careers"},
    {"key": "hancock_whitney", "employer": "Hancock Whitney", "ats": "workday",
     "tenant": "hancockwhitney", "wd": 5, "site": "Careers"},
    {"key": "frost", "employer": "Frost Bank", "ats": "workday",
     "tenant": "frostbank", "wd": 5, "site": "external"},
    {"key": "simmons", "employer": "Simmons Bank", "ats": "workday",
     "tenant": "simmonsbank", "wd": 5, "site": "SimmonsCareers"},
    # --- Energy lenders and energy investment / corporate banking ---
    {"key": "mufg", "employer": "MUFG", "ats": "workday",
     "tenant": "mufgub", "wd": 3, "site": "MUFG-Careers"},
    {"key": "mizuho", "employer": "Mizuho Americas", "ats": "workday",
     "tenant": "mizuho", "wd": 1, "site": "mizuhoamericas"},
    # --- Middle-market investment banks / M&A boutiques ---
    {"key": "piper_sandler", "employer": "Piper Sandler", "ats": "workday",
     "tenant": "pipersandler", "wd": 501, "site": "Piper_Sandler_Careers"},
    {"key": "houlihan_lokey", "employer": "Houlihan Lokey", "ats": "workday",
     "tenant": "hl", "wd": 1, "site": "Campus"},
    # --- Houston energy companies: credit, trade finance, corporate finance ---
    {"key": "trafigura", "employer": "Trafigura", "ats": "workday",
     "tenant": "trafigura", "wd": 3, "site": "TrafiguraCareerSite"},
    {"key": "engelhart", "employer": "Engelhart", "ats": "greenhouse",
     "board": "engelhart"},
    {"key": "williams", "employer": "Williams Companies", "ats": "workday",
     "tenant": "williams", "wd": 5, "site": "External"},
    {"key": "plains", "employer": "Plains All American", "ats": "workday",
     "tenant": "plains", "wd": 1, "site": "plains"},
    {"key": "cheniere", "employer": "Cheniere Energy", "ats": "oracle",
     "host": "hcgi.fa.us2.oraclecloud.com", "site": "CX_2"},
]

SOURCES_BY_KEY = {s["key"]: s for s in SOURCES}

HISTORY_COLUMNS = [
    "posting_id", "source", "source_id", "employer", "title", "location",
    "department", "posted_date", "url", "in_role", "first_run", "first_seen",
    "last_seen", "status", "removed_date",
]
