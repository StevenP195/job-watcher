import gzip
import json

import pytest


@pytest.fixture
def write_raw(tmp_path):
    """Write a raw file the same way the fetch step does; returns the raw dir."""
    raw = tmp_path / "raw"

    def _write(date, source, ats, jobs, employer="Test Employer"):
        d = raw / date
        d.mkdir(parents=True, exist_ok=True)
        payload = {"source": source, "employer": employer, "ats": ats,
                   "fetched_at": f"{date}T12:00:00Z", "total": len(jobs), "search": "", "jobs": jobs}
        with gzip.open(d / f"{source}.json.gz", "wt", encoding="utf-8") as f:
            json.dump(payload, f)
        return raw

    _write.raw = raw
    return _write
