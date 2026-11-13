"""Write data/status.json describing the latest run."""

import json

from . import config
from .history import raw_days


def latest_day(rows):
    dates = [r[k] for r in rows for k in ("last_seen", "removed_date") if r.get(k)]
    return max(dates) if dates else ""


def is_true(v):
    return v is True or str(v).lower() == "true"


def build_status(rows, raw_dir=config.RAW, runs_dir=config.RUNS):
    days = raw_days(raw_dir)
    dates = sorted(days)
    last = dates[-1] if dates else ""

    # the latest run record (a run where every source failed has no raw files
    # but still has a run record, and is still the latest run)
    run_files = sorted(runs_dir.glob("*.json")) if runs_dir.exists() else []
    run_file = run_files[-1] if run_files else None
    if run_file:
        run = json.loads(run_file.read_text(encoding="utf-8"))
        run_time = run["run_time"]
        sources = [{"name": s["name"], "employer": s.get("employer", ""), "ats": s.get("ats", ""),
                    "ok": s["ok"], "count": s["count"], "error": s.get("error", "")}
                   for s in run["sources"]]
    else:  # no run record: describe the latest raw files
        run_time = f"{last}T00:00:00Z" if last else ""
        sources = []
        for cfg in config.SOURCES:
            ok = cfg["key"] in days.get(last, {})
            sources.append({"name": cfg["key"], "employer": cfg["employer"], "ats": cfg["ats"],
                            "ok": ok, "count": sum(r["source"] == cfg["key"] and r["last_seen"] == last
                                                   for r in rows) if ok else 0, "error": ""})

    return {
        "run_time": run_time,
        "first_run_date": dates[0] if dates else "",
        "days_with_success": len(dates),
        "open": sum(r["status"] == "open" for r in rows),
        "new_today": sum(r["first_seen"] == last and not is_true(r["first_run"]) for r in rows),
        "removed_today": sum(r["removed_date"] == last for r in rows),
        "sources": sources,
    }


def write_status(status, path=config.STATUS):
    path.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
