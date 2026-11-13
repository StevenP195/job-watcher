"""Greenhouse job boards: GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true"""

from ..http import request_json


def fetch(cfg):
    data = request_json(f"https://boards-api.greenhouse.io/v1/boards/{cfg['board']}/jobs?content=true")
    jobs = data.get("jobs", [])
    for j in jobs:  # the HTML description is large and not used
        j.pop("content", None)
    return {"total": len(jobs), "search": "", "jobs": jobs}


def normalize(payload, fetch_date, cfg):
    from . import common
    out = []
    for job in payload.get("jobs", []):
        depts = job.get("departments") or []
        out.append(common(
            source=cfg["key"],
            source_id=job["id"],
            employer=cfg["employer"],
            title=job.get("title"),
            location=(job.get("location") or {}).get("name", ""),
            department=depts[0]["name"] if depts else "",
            posted_date=(job.get("first_published") or "")[:10],
            url=job.get("absolute_url", ""),
        ))
    return out
