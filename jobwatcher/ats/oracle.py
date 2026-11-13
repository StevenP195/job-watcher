"""Oracle Recruiting Cloud (Candidate Experience):
GET https://{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions
    ?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber={site},limit=..,offset=..
"""

from urllib.parse import quote

from ..http import request_json

PAGE = 100


def fetch(cfg):
    jobs, total, offset = [], None, 0
    search = cfg.get("search", "")
    while True:
        finder = f"findReqs;siteNumber={cfg['site']},limit={PAGE},offset={offset},sortBy=POSTING_DATES_DESC"
        if search:
            finder += f",keyword={quote(search)}"
        url = (f"https://{cfg['host']}/hcmRestApi/resources/latest/recruitingCEJobRequisitions"
               f"?onlyData=true&expand=requisitionList&finder={finder}")
        item = (request_json(url).get("items") or [{}])[0]
        if total is None:
            total = item.get("TotalJobsCount", 0)
        batch = item.get("requisitionList") or []
        jobs.extend(batch)
        offset += PAGE
        if not batch or offset >= total:
            break
    for j in jobs:
        j.pop("ShortDescriptionStr", None)
    return {"total": total, "search": search, "jobs": jobs}


def normalize(payload, fetch_date, cfg):
    from . import common
    out = []
    for job in payload.get("jobs", []):
        out.append(common(
            source=cfg["key"],
            source_id=job["Id"],
            employer=cfg["employer"],
            title=job.get("Title"),
            location=job.get("PrimaryLocation", ""),
            department=job.get("Department") or job.get("JobFamily") or "",
            posted_date=(job.get("PostedDate") or "")[:10],
            url=f"https://{cfg['host']}/hcmUI/CandidateExperience/en/sites/{cfg['site']}/job/{job['Id']}",
        ))
    return out
