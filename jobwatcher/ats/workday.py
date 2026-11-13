"""Workday career sites: POST https://{tenant}.wd{n}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs

The list endpoint returns 20 postings per page with title, externalPath,
locationsText and a relative postedOn ("Posted 3 Days Ago"). Postings with
several locations only say "3 Locations", so for those the fetch also calls the
posting's detail endpoint and stores it under "detail" in the raw file.
"""

import datetime as dt
import re
from concurrent.futures import ThreadPoolExecutor

from ..http import request_json

PAGE = 20
MAX_DETAILS = 300  # cap detail calls per source per day
MULTI_LOC = re.compile(r"^\d+\s+Locations?$", re.I)


def base(cfg):
    return f"https://{cfg['tenant']}.wd{cfg['wd']}.myworkdayjobs.com"


def fetch(cfg):
    url = f"{base(cfg)}/wday/cxs/{cfg['tenant']}/{cfg['site']}/jobs"
    search = cfg.get("search", "")
    jobs, total, offset = [], None, 0
    while True:
        page = request_json(url, {"appliedFacets": {}, "limit": PAGE,
                                  "offset": offset, "searchText": search})
        if total is None:  # Workday only reports the total on the first page
            total = page.get("total", 0)
        batch = page.get("jobPostings") or []
        jobs.extend(batch)
        offset += PAGE
        if not batch or offset >= total:
            break

    multi = [j for j in jobs if MULTI_LOC.match(j.get("locationsText") or "")][:MAX_DETAILS]

    def detail(job):
        try:
            d = request_json(f"{base(cfg)}/wday/cxs/{cfg['tenant']}/{cfg['site']}{job['externalPath']}",
                             retries=2)
            info = d.get("jobPostingInfo", {})
            job["detail"] = {k: info.get(k) for k in
                             ("location", "additionalLocations", "startDate", "jobReqId", "timeType")}
        except Exception:
            pass  # keep the list entry; location stays "N Locations"

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(detail, multi))

    return {"total": total, "search": search, "jobs": jobs}


def source_id(job):
    """Workday paths end in _<requisition id>, e.g. /job/Houston-TX/Credit-Analyst_R-2568-1."""
    path = job.get("externalPath", "")
    tail = path.rsplit("/", 1)[-1]
    return tail.rsplit("_", 1)[-1] if "_" in tail else tail


def posted_date(job, fetch_date):
    detail = job.get("detail") or {}
    if detail.get("startDate"):
        return detail["startDate"][:10]
    text = (job.get("postedOn") or "").lower()
    if "today" in text:
        days = 0
    elif "yesterday" in text:
        days = 1
    else:
        m = re.search(r"(\d+)(\+)?\s+days", text)
        if not m or m.group(2):  # "30+ Days Ago" has no exact date
            return ""
        days = int(m.group(1))
    return (dt.date.fromisoformat(fetch_date) - dt.timedelta(days=days)).isoformat()


def location(job):
    detail = job.get("detail") or {}
    if detail.get("location"):
        locs = [detail["location"], *(detail.get("additionalLocations") or [])]
        return "; ".join(dict.fromkeys(locs))
    return job.get("locationsText", "")


def normalize(payload, fetch_date, cfg):
    from . import common
    out = []
    for job in payload.get("jobs", []):
        if not job.get("externalPath"):
            continue
        out.append(common(
            source=cfg["key"],
            source_id=source_id(job),
            employer=cfg["employer"],
            title=job.get("title"),
            location=location(job),
            department="",  # the Workday list endpoint has no department
            posted_date=posted_date(job, fetch_date),
            url=f"{base(cfg)}/en-US/{cfg['site']}{job['externalPath']}",
        ))
    return out
