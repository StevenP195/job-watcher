"""Call every source and save what it returns to data/raw/<date>/<source>.json.gz.

One source failing never stops the run: it writes no raw file that day, and the
result of every source (ok / count / error) is recorded in data/runs/<date>.json.
A second run on the same day replaces that day's raw files.
"""

import datetime as dt
import gzip
import json
import shutil
import traceback
from concurrent.futures import ThreadPoolExecutor

from . import config
from .ats import ADAPTERS


def utc_now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def fetch_one(cfg, date, fetched_at):
    try:
        result = ADAPTERS[cfg["ats"]].fetch(cfg)
        payload = {
            "source": cfg["key"], "employer": cfg["employer"], "ats": cfg["ats"],
            "fetched_at": fetched_at, **result,
        }
        if not payload["jobs"] and payload.get("total", 0) > 0:
            raise RuntimeError("board reported postings but returned none")
        path = config.RAW / date / f"{cfg['key']}.json.gz"
        with gzip.open(path, "wt", encoding="utf-8") as f:
            json.dump(payload, f, separators=(",", ":"), sort_keys=True)
        return {"name": cfg["key"], "employer": cfg["employer"], "ats": cfg["ats"],
                "ok": True, "count": len(payload["jobs"]), "error": ""}
    except Exception as e:
        traceback.print_exc()
        return {"name": cfg["key"], "employer": cfg["employer"], "ats": cfg["ats"],
                "ok": False, "count": 0, "error": str(e)[:300]}


def fetch_all(sources=None, now=None):
    now = now or utc_now()
    date = now.date().isoformat()
    fetched_at = now.isoformat().replace("+00:00", "Z")
    day_dir = config.RAW / date
    if day_dir.exists():  # a re-run replaces that day's raw files
        shutil.rmtree(day_dir)
    day_dir.mkdir(parents=True)

    sources = sources or config.SOURCES
    with ThreadPoolExecutor(6) as ex:
        results = list(ex.map(lambda c: fetch_one(c, date, fetched_at), sources))

    if not any(day_dir.iterdir()):
        day_dir.rmdir()
    run = {"run_time": fetched_at, "date": date, "sources": results}
    config.RUNS.mkdir(parents=True, exist_ok=True)
    (config.RUNS / f"{date}.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")
    for r in results:
        print(f"{'OK  ' if r['ok'] else 'FAIL'} {r['name']:16} {r['count']:5}  {r['error']}")
    return run
