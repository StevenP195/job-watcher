"""first_seen / last_seen / removed logic, built from raw files alone."""

import json

from jobwatcher import history, status


def gh(i, title="Credit Analyst"):
    return {"id": i, "title": title, "location": {"name": "Houston, TX"},
            "absolute_url": f"https://example.com/{i}"}


def by_id(rows):
    return {r["posting_id"]: r for r in rows}


def test_first_day_postings_are_first_run(write_raw):
    raw = write_raw("2026-11-13", "a", "greenhouse", [gh(1), gh(2)])
    rows = by_id(history.build(raw))
    for pid in ("a:1", "a:2"):
        r = rows[pid]
        assert r["first_run"] is True
        assert r["first_seen"] == r["last_seen"] == "2026-11-13"
        assert r["status"] == "open" and r["removed_date"] == ""


def test_new_posting_and_last_seen(write_raw):
    write_raw("2026-11-13", "a", "greenhouse", [gh(1)])
    raw = write_raw("2026-11-14", "a", "greenhouse", [gh(1), gh(2)])
    rows = by_id(history.build(raw))
    assert rows["a:1"]["first_seen"] == "2026-11-13" and rows["a:1"]["last_seen"] == "2026-11-14"
    assert rows["a:2"]["first_seen"] == "2026-11-14" and rows["a:2"]["first_run"] is False


def test_removed_when_no_longer_listed(write_raw):
    write_raw("2026-11-13", "a", "greenhouse", [gh(1), gh(2)])
    raw = write_raw("2026-11-14", "a", "greenhouse", [gh(1)])
    r = by_id(history.build(raw))["a:2"]
    assert r["status"] == "removed" and r["removed_date"] == "2026-11-14"
    assert r["last_seen"] == "2026-11-13"


def test_failed_source_day_does_not_remove(write_raw):
    """No raw file for a source that day (fetch failed) -> its postings stay open."""
    write_raw("2026-11-13", "a", "greenhouse", [gh(1)])
    write_raw("2026-11-13", "b", "greenhouse", [gh(9)])
    raw = write_raw("2026-11-14", "b", "greenhouse", [gh(9)])  # source a failed on the 14th
    r = by_id(history.build(raw))["a:1"]
    assert r["status"] == "open" and r["removed_date"] == "" and r["last_seen"] == "2026-11-13"


def test_reopened_posting_keeps_first_seen(write_raw):
    write_raw("2026-11-13", "a", "greenhouse", [gh(1)])
    write_raw("2026-11-14", "a", "greenhouse", [gh(2)])
    raw = write_raw("2026-11-15", "a", "greenhouse", [gh(1), gh(2)])
    r = by_id(history.build(raw))["a:1"]
    assert r["status"] == "open" and r["removed_date"] == ""
    assert r["first_seen"] == "2026-11-13" and r["last_seen"] == "2026-11-15"
    assert r["first_run"] is True


def test_source_added_later_is_first_run_on_its_first_file(write_raw):
    write_raw("2026-11-13", "a", "greenhouse", [gh(1)])
    raw = write_raw("2026-11-14", "b", "greenhouse", [gh(5)])
    r = by_id(history.build(raw))["b:5"]
    assert r["first_run"] is True and r["first_seen"] == "2026-11-14"


def test_in_role_uses_title_rule(write_raw):
    raw = write_raw("2026-11-13", "a", "greenhouse", [gh(1, "Credit Analyst"), gh(2, "HR Intern")])
    rows = by_id(history.build(raw))
    assert rows["a:1"]["in_role"] is True and rows["a:2"]["in_role"] is False


def test_rows_sorted_and_build_is_reproducible(write_raw, tmp_path):
    write_raw("2026-11-13", "b", "greenhouse", [gh(3), gh(1)])
    raw = write_raw("2026-11-13", "a", "greenhouse", [gh(2)])
    rows = history.build(raw)
    assert [r["posting_id"] for r in rows] == sorted(r["posting_id"] for r in rows)
    p1, p2 = tmp_path / "h1.csv", tmp_path / "h2.csv"
    history.write_csv(rows, p1)
    history.write_csv(history.build(raw), p2)
    assert p1.read_bytes() == p2.read_bytes()
    header = p1.read_text(encoding="utf-8").splitlines()[0]
    assert header == ("posting_id,source,source_id,employer,title,location,department,posted_date,"
                      "url,in_role,first_run,first_seen,last_seen,status,removed_date")


def test_duplicate_listing_counts_once(write_raw):
    raw = write_raw("2026-11-13", "a", "greenhouse", [gh(1), gh(1)])
    assert len(history.build(raw)) == 1


def test_status_counts(write_raw, tmp_path):
    write_raw("2026-11-13", "a", "greenhouse", [gh(1), gh(2)])
    raw = write_raw("2026-11-14", "a", "greenhouse", [gh(1), gh(3)])
    history.write_csv(history.build(raw), tmp_path / "h.csv")
    rows = history.read_csv(tmp_path / "h.csv")
    runs = tmp_path / "runs"
    runs.mkdir()
    (runs / "2026-11-14.json").write_text(json.dumps({
        "run_time": "2026-11-14T11:30:00Z", "date": "2026-11-14",
        "sources": [{"name": "a", "ok": True, "count": 2, "error": ""},
                    {"name": "b", "ok": False, "count": 0, "error": "HTTP 500"}]}))
    st = status.build_status(rows, raw, runs)
    assert st["run_time"] == "2026-11-14T11:30:00Z"
    assert st["first_run_date"] == "2026-11-13"
    assert st["days_with_success"] == 2
    assert st["open"] == 2
    assert st["new_today"] == 1        # a:3 (a:1 is first-run)
    assert st["removed_today"] == 1    # a:2
    assert [s["ok"] for s in st["sources"]] == [True, False]
    assert set(st) >= {"run_time", "first_run_date", "days_with_success", "open",
                       "new_today", "removed_today", "sources"}
    assert set(st["sources"][0]) >= {"name", "ok", "count"}
