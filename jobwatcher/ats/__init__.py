"""One module per applicant tracking system. Each exposes:

fetch(cfg) -> dict          raw payload saved as data/raw/<date>/<source>.json.gz
normalize(payload, date)    -> list of postings in the common columns
"""

from . import greenhouse, oracle, workday

ADAPTERS = {"workday": workday, "greenhouse": greenhouse, "oracle": oracle}


def common(source, source_id, employer, title, location="", department="",
           posted_date="", url=""):
    """Common column set shared by every source (history fields added later)."""
    clean = lambda v: " ".join(str(v or "").split())
    return {
        "posting_id": f"{source}:{source_id}",
        "source": source,
        "source_id": str(source_id),
        "employer": clean(employer),
        "title": clean(title),
        "location": clean(location),
        "department": clean(department),
        "posted_date": posted_date or "",
        "url": url or "",
    }
