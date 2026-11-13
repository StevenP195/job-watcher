"""Build data/history.csv from the raw files alone.

The build replays every day of raw files in date order, so running it again
gives the same file, and a change to a rule (title rule, conversion) applies to
every day of the history.

Per day, per source that has a raw file that day:
  * a posting seen for the first time gets first_seen = that day
    (first_run = true when that day is the source's first raw file)
  * every posting listed that day gets last_seen = that day
  * an open posting the source no longer lists becomes removed, removed_date = that day
  * a removed posting that is listed again re-opens: removed_date cleared,
    first_seen unchanged
Sources with no raw file on a day (failed fetch) are left untouched that day.
"""

import csv
import gzip
import json
from pathlib import Path

from . import config
from .ats import ADAPTERS
from .title_rule import in_role


def raw_days(raw_dir: Path):
    """{date: {source: path}} for every raw file, dates sorted."""
    days = {}
    for day in sorted(p for p in raw_dir.glob("*") if p.is_dir()):
        files = {f.name[: -len(".json.gz")]: f for f in sorted(day.glob("*.json.gz"))}
        if files:
            days[day.name] = files
    return days


def load_raw(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return json.load(f)


def normalize_payload(payload, date, cfg=None):
    cfg = cfg or config.SOURCES_BY_KEY.get(payload["source"]) or {
        "key": payload["source"], "employer": payload.get("employer", payload["source"])}
    rows = ADAPTERS[payload["ats"]].normalize(payload, date, cfg)
    # one row per posting id (a board can list the same posting twice)
    return list({r["posting_id"]: r for r in rows}.values())


def apply_day(history: dict, date: str, source: str, postings: list, first_file: bool):
    """Update history (posting_id -> row) with one source's postings for one day."""
    listed = set()
    for p in postings:
        pid = p["posting_id"]
        listed.add(pid)
        row = history.get(pid)
        if row is None:
            row = history[pid] = {**p, "first_run": first_file, "first_seen": date}
        else:
            # keep the newest values the board reports; keep a known posted_date
            for k, v in p.items():
                if v or k != "posted_date":
                    row[k] = v
        row["in_role"] = in_role(row["title"])
        row["last_seen"] = date
        row["status"] = "open"
        row["removed_date"] = ""
    for pid, row in history.items():
        if row["source"] == source and row["status"] == "open" and pid not in listed:
            row["status"] = "removed"
            row["removed_date"] = date


def build(raw_dir: Path = config.RAW):
    history, seen_sources = {}, set()
    for date, files in raw_days(raw_dir).items():
        for source, path in files.items():
            payload = load_raw(path)
            postings = normalize_payload(payload, date)
            apply_day(history, date, source, postings, first_file=source not in seen_sources)
            seen_sources.add(source)
    return [history[k] for k in sorted(history)]


def fmt(v):
    return ("true" if v else "false") if isinstance(v, bool) else ("" if v is None else str(v))


def write_csv(rows, path: Path = config.HISTORY):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=config.HISTORY_COLUMNS, extrasaction="ignore",
                           lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: fmt(r.get(k)) for k in config.HISTORY_COLUMNS})


def read_csv(path: Path = config.HISTORY):
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))
