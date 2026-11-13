"""Conversion of each source type to the common columns."""

from jobwatcher.ats import greenhouse, oracle, workday
from jobwatcher.config import SOURCES

COMMON = {"posting_id", "source", "source_id", "employer", "title", "location",
          "department", "posted_date", "url"}

WD_CFG = {"key": "origin_bank", "employer": "Origin Bank", "ats": "workday",
          "tenant": "originbank", "wd": 1, "site": "Careers"}


def test_workday_basic_posting():
    payload = {"jobs": [{
        "title": "Credit Analyst II",
        "externalPath": "/job/Houston-Texas-77024/Credit-Analyst-II_R-2571-1",
        "locationsText": "Houston, Texas 77024",
        "postedOn": "Posted 3 Days Ago",
    }]}
    [row] = workday.normalize(payload, "2026-11-13", WD_CFG)
    assert set(row) == COMMON
    assert row["posting_id"] == "origin_bank:R-2571-1"
    assert row["source_id"] == "R-2571-1"
    assert row["employer"] == "Origin Bank"
    assert row["location"] == "Houston, Texas 77024"
    assert row["department"] == ""            # Workday list has no department
    assert row["posted_date"] == "2026-11-10"  # 3 days before the fetch date
    assert row["url"] == ("https://originbank.wd1.myworkdayjobs.com/en-US/Careers"
                          "/job/Houston-Texas-77024/Credit-Analyst-II_R-2571-1")


def test_workday_posted_on_variants():
    job = lambda s: {"postedOn": s}
    assert workday.posted_date(job("Posted Today"), "2026-11-13") == "2026-11-13"
    assert workday.posted_date(job("Posted Yesterday"), "2026-11-13") == "2026-11-12"
    assert workday.posted_date(job("Posted 30+ Days Ago"), "2026-11-13") == ""
    assert workday.posted_date(job(""), "2026-11-13") == ""


def test_workday_multi_location_uses_detail():
    payload = {"jobs": [{
        "title": "Credit Analyst - Power & Utilities",
        "externalPath": "/job/New-York-NY/Credit-Analyst_10069999-WD",
        "locationsText": "3 Locations",
        "postedOn": "Posted 30+ Days Ago",
        "detail": {"location": "New York, NY", "additionalLocations": ["Houston, TX", "Los Angeles, CA"],
                   "startDate": "2026-09-30"},
    }]}
    [row] = workday.normalize(payload, "2026-11-13", WD_CFG)
    assert row["location"] == "New York, NY; Houston, TX; Los Angeles, CA"
    assert row["posted_date"] == "2026-09-30"
    assert row["source_id"] == "10069999-WD"


def test_workday_skips_entries_without_path():
    assert workday.normalize({"jobs": [{"title": "x"}]}, "2026-11-13", WD_CFG) == []


def test_greenhouse_posting():
    cfg = {"key": "engelhart", "employer": "Engelhart", "ats": "greenhouse", "board": "engelhart"}
    payload = {"jobs": [{
        "id": 8371754, "title": "Treasury and Trade Finance Analyst",
        "location": {"name": "Houston, Texas; Stamford, Connecticut"},
        "departments": [{"name": "Finance"}],
        "first_published": "2026-11-10T09:40:46-05:00",
        "absolute_url": "https://job-boards.greenhouse.io/engelhart/jobs/8371754",
    }]}
    [row] = greenhouse.normalize(payload, "2026-11-13", cfg)
    assert set(row) == COMMON
    assert row["posting_id"] == "engelhart:8371754"
    assert row["department"] == "Finance"
    assert row["posted_date"] == "2026-11-10"
    assert row["location"] == "Houston, Texas; Stamford, Connecticut"
    assert row["url"].endswith("/jobs/8371754")


def test_greenhouse_missing_optional_fields():
    cfg = {"key": "engelhart", "employer": "Engelhart"}
    [row] = greenhouse.normalize({"jobs": [{"id": 1, "title": "Analyst"}]}, "2026-11-13", cfg)
    assert row["department"] == "" and row["posted_date"] == "" and row["location"] == ""


def test_oracle_posting():
    cfg = {"key": "cheniere", "employer": "Cheniere Energy", "ats": "oracle",
           "host": "hcgi.fa.us2.oraclecloud.com", "site": "CX_2"}
    payload = {"jobs": [{
        "Id": "25000327", "Title": "Lead Analyst, HR Services",
        "PrimaryLocation": "Houston, TX, United States", "PostedDate": "2026-10-29",
        "Department": None, "JobFamily": None,
    }]}
    [row] = oracle.normalize(payload, "2026-11-13", cfg)
    assert set(row) == COMMON
    assert row["posting_id"] == "cheniere:25000327"
    assert row["posted_date"] == "2026-10-29"
    assert row["department"] == ""
    assert row["url"] == ("https://hcgi.fa.us2.oraclecloud.com/hcmUI/CandidateExperience"
                          "/en/sites/CX_2/job/25000327")


def test_whitespace_is_cleaned():
    cfg = {"key": "engelhart", "employer": "Engelhart"}
    [row] = greenhouse.normalize({"jobs": [{"id": 2, "title": "  Credit \n Analyst "}]}, "2026-11-13", cfg)
    assert row["title"] == "Credit Analyst"


def test_watch_list_meets_assignment_minimum():
    assert len(SOURCES) >= 15
    assert len({s["key"] for s in SOURCES}) == len(SOURCES)
    assert {s["ats"] for s in SOURCES} >= {"workday", "greenhouse", "oracle"}
