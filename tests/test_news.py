"""News tab: RSS parsing, filters, same-story merging, and the no-API-key fallback."""

import datetime as dt
import json

from jobwatcher import news

RSS = """<?xml version="1.0"?><rss><channel>
<item><title>Origin Bank names new Houston market president - Houston Business Journal</title>
  <link>https://news.example/a</link><pubDate>Thu, 12 Nov 2026 15:00:00 GMT</pubDate>
  <source url="https://bizjournals.com">Houston Business Journal</source></item>
<item><title>Origin Bancorp (OBK) Stock Price, News &amp; Analysis - MarketBeat</title>
  <link>https://news.example/b</link><pubDate>Thu, 12 Nov 2026 14:00:00 GMT</pubDate>
  <source url="https://marketbeat.com">MarketBeat</source></item>
<item><title>No date here</title><link>https://news.example/c</link></item>
</channel></rss>"""


def test_parse_rss_strips_source_and_reads_dates():
    items = news.parse_rss(RSS)
    assert len(items) == 2  # the undated item is skipped
    assert items[0]["title"] == "Origin Bank names new Houston market president"
    assert items[0]["source"] == "Houston Business Journal"
    assert items[0]["published"] == "2026-11-12T15:00:00Z"


def test_noise_filter():
    for t in ["Fall Out Boy at Fifth Third Park", "Piper Sandler raises price target on Cisco",
              "Apollo Global $APO Stock Purchased by Fifth Third Bancorp", "Zach Johnson birdie at Simmons Bank",
              "Origin Bancorp (OBK) Stock Price, News & Analysis"]:
        assert news.is_noise(t), t
    for t in ["Hancock Whitney to buy Trustmark in $3.2B deal", "Cheniere prices $1.2 billion of senior notes",
              "Frost Bank breaks ground on New Caney location"]:
        assert not news.is_noise(t), t


def test_headline_must_name_the_firm():
    assert news.names_firm("Huntington expands commercial banking in Texas", "huntington")
    assert not news.names_firm("Texans offense struggles in Week 10", "huntington")


def test_same_story_merging():
    firm = news.words("hancock whitney")
    assert news.same_story("Hancock Whitney to buy Trustmark in $3.2B deal",
                           "Hancock Whitney agrees to $3.2 Billion Trustmark merger", firm)
    assert not news.same_story("Hancock Whitney to buy Trustmark in $3.2B deal",
                               "Hancock Whitney Corporation Announces Quarterly Dividend", firm)


def test_run_without_api_key_uses_interview_tips(tmp_path, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.setattr(news, "fetch_rss", lambda q: news.parse_rss(RSS))
    out = news.run(now=dt.datetime(2026, 11, 13, 12, tzinfo=dt.timezone.utc), path=tmp_path / "news.json")
    saved = json.loads((tmp_path / "news.json").read_text(encoding="utf-8"))
    assert saved == out and out["ai_summaries"] is False
    origin = [i for i in out["items"] if i["company"] == "origin_bank"]
    assert len(origin) == 1 and origin[0]["scope"] == "houston"
    s = origin[0]["summary"]
    assert s["ai"] is False and s["why"] and s["interview"]


def test_failed_feed_keeps_previous_headlines(tmp_path, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    path = tmp_path / "news.json"
    monkeypatch.setattr(news, "fetch_rss", lambda q: news.parse_rss(RSS))
    news.run(now=dt.datetime(2026, 11, 13, 12, tzinfo=dt.timezone.utc), path=path)

    def broken(q):
        raise OSError("feed down")
    monkeypatch.setattr(news, "fetch_rss", broken)
    out = news.run(now=dt.datetime(2026, 11, 14, 12, tzinfo=dt.timezone.utc), path=path)
    assert all(not c["ok"] for c in out["companies"])
    assert any(i["company"] == "origin_bank" for i in out["items"])
