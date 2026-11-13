"""The six Market page numbers, computed from history.csv in Python.

The Market page (market.html / assets/market.js) computes the same numbers in
the browser; this module exists so they can be checked against each other.
"""

import datetime as dt
import statistics
from collections import Counter

from .status import is_true


def d(s):
    return dt.date.fromisoformat(s)


def last_run(rows):
    dates = [r[k] for r in rows for k in ("last_seen", "removed_date") if r.get(k)]
    return max(dates) if dates else None


def compute(rows):
    last = last_run(rows)
    not_first = [r for r in rows if not is_true(r["first_run"])]
    new_all = Counter(r["first_seen"] for r in not_first)
    new_role = Counter(r["first_seen"] for r in not_first if is_true(r["in_role"]))
    removed = Counter(r["removed_date"] for r in rows if r["removed_date"])
    open_rows = [r for r in rows if r["status"] == "open"]
    by_employer = Counter(r["employer"] for r in open_rows)
    days_open = [(d(r["removed_date"]) - d(r["first_seen"])).days
                 for r in not_first if r["removed_date"]]
    eligible = [r for r in not_first if last and (d(last) - d(r["first_seen"])).days >= 7]
    quick = [r for r in eligible
             if r["removed_date"] and (d(r["removed_date"]) - d(r["first_seen"])).days <= 7]
    locations = Counter(r["location"] or "(not given)" for r in open_rows)
    return {
        "last_run": last,
        "new_per_day_all": dict(sorted(new_all.items())),
        "new_per_day_role": dict(sorted(new_role.items())),
        "removed_per_day": dict(sorted(removed.items())),
        "open_per_employer": dict(by_employer.most_common()),
        "days_open_median": statistics.median(days_open) if days_open else None,
        "days_open_n": len(days_open),
        "removed_within_7_share": (len(quick) / len(eligible)) if eligible else None,
        "removed_within_7_n": (len(quick), len(eligible)),
        "top_locations": dict(locations.most_common(10)),
    }


def report(rows):
    m = compute(rows)
    print(f"Last run: {m['last_run']}")
    print("1. New postings per day (all / role):")
    for day, n in m["new_per_day_all"].items():
        print(f"   {day}: {n} / {m['new_per_day_role'].get(day, 0)}")
    print("2. Removed postings per day:", m["removed_per_day"] or "none yet")
    print("3. Open postings per employer:")
    for e, n in m["open_per_employer"].items():
        print(f"   {n:5}  {e}")
    print(f"4. Median days open: {m['days_open_median']} (n={m['days_open_n']})")
    q, e = m["removed_within_7_n"]
    share = m["removed_within_7_share"]
    print(f"5. Share removed within 7 days: {'n/a' if share is None else f'{share:.1%}'} ({q}/{e})")
    print("6. Top locations among open postings:")
    for loc, n in m["top_locations"].items():
        print(f"   {n:5}  {loc}")
