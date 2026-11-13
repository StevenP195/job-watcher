"""Daily GitHub Issue: titled with the date, lists new and removed postings
(in-role first), each with a link; closes the previous day's issue.

Uses the GitHub REST API with GITHUB_TOKEN / GITHUB_REPOSITORY (set by Actions).
A second run on the same day edits that day's issue instead of opening another.
"""

import json
import os
import urllib.request

from . import config
from .status import is_true

LABEL = "daily-report"
MAX_BODY = 60000  # GitHub limit is 65,536 characters per issue body / comment


def line(r):
    loc = f" · {r['location']}" if r.get("location") else ""
    return f"- [{r['title']}]({r['url']}) — {r['employer']}{loc}"


def section(title, rows):
    out = [f"### {title} ({len(rows)})"]
    out += [line(r) for r in sorted(rows, key=lambda r: (r["employer"], r["title"]))] or ["_None._"]
    return out


def render(date, rows, status, site_url=""):
    new = [r for r in rows if r["first_seen"] == date and not is_true(r["first_run"])]
    removed = [r for r in rows if r["removed_date"] == date]
    role = lambda xs, want: [r for r in xs if is_true(r["in_role"]) == want]
    failed = [s["name"] for s in status["sources"] if not s["ok"]]

    lines = [
        f"cc @{config.NOTIFY_USER} — job watch for **{date}**",
        "",
        f"**{sum('houston' in r['location'].lower() for r in role(new, True))} new in your role in Houston**, "
        f"{len(role(new, True))} new in your role anywhere, {len(new)} new overall, "
        f"{len(removed)} removed, {status['open']} open across "
        f"{sum(s['ok'] for s in status['sources'])}/{len(status['sources'])} sources.",
    ]
    if failed:
        lines.append(f"⚠️ Sources that failed today: {', '.join(failed)}")
    if site_url:
        lines.append(f"Site: {site_url}")
    lines.append("")
    houston = lambda xs: [r for r in xs if "houston" in r["location"].lower()]
    elsewhere = lambda xs: [r for r in xs if "houston" not in r["location"].lower()]
    lines += section("🏙️ New postings — in your role, Houston", houston(role(new, True))) + [""]
    lines += section("New postings — in your role, other locations", elsewhere(role(new, True))) + [""]
    lines += section("Removed postings — in your role", role(removed, True)) + [""]
    lines += section("New postings — all other", role(new, False)) + [""]
    lines += section("Removed postings — all other", role(removed, False))
    return split_chunks(lines)


def split_chunks(lines):
    """Issue body first, then comments, each under GitHub's size limit."""
    chunks, cur = [], ""
    for ln in lines:
        if len(cur) + len(ln) + 1 > MAX_BODY:
            chunks.append(cur)
            cur = "_(continued)_\n"
        cur += ln + "\n"
    chunks.append(cur)
    return chunks


class GitHub:
    def __init__(self, token, repo):
        self.token, self.repo = token, repo

    def call(self, method, path, body=None):
        req = urllib.request.Request(
            f"https://api.github.com/repos/{self.repo}{path}",
            data=json.dumps(body).encode() if body is not None else None, method=method,
            headers={"Authorization": f"Bearer {self.token}", "Accept": "application/vnd.github+json",
                     "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "job-watcher"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
            return json.loads(data) if data else None


def publish(date, chunks, token=None, repo=None):
    token = token or os.environ.get("GITHUB_TOKEN")
    repo = repo or os.environ.get("GITHUB_REPOSITORY")
    if not (token and repo):
        print("No GITHUB_TOKEN/GITHUB_REPOSITORY: skipping issue (preview written to build/issue.md)")
        return None
    gh = GitHub(token, repo)
    try:
        gh.call("POST", "/labels", {"name": LABEL, "color": "7cc4e4"})
    except Exception:
        pass  # label already exists

    open_issues = gh.call("GET", f"/issues?state=open&labels={LABEL}&per_page=100") or []
    today = next((i for i in open_issues if i["title"] == date), None)
    if today is None:  # same-day re-run after the issue was closed by hand
        closed = gh.call("GET", f"/issues?state=closed&labels={LABEL}&per_page=30") or []
        today = next((i for i in closed if i["title"] == date), None)

    if today:
        num = today["number"]
        gh.call("PATCH", f"/issues/{num}", {"body": chunks[0], "state": "open"})
        for c in gh.call("GET", f"/issues/{num}/comments?per_page=100") or []:
            if c["user"]["type"] == "Bot":
                gh.call("DELETE", f"/issues/comments/{c['id']}")
    else:
        num = gh.call("POST", "/issues", {"title": date, "body": chunks[0], "labels": [LABEL]})["number"]
    for extra in chunks[1:]:
        gh.call("POST", f"/issues/{num}/comments", {"body": extra})

    for i in open_issues:  # close the previous day's issue(s)
        if i["title"] != date and "pull_request" not in i:
            gh.call("PATCH", f"/issues/{i['number']}", {"state": "closed", "state_reason": "completed"})
    print(f"Issue #{num} ({date}) updated")
    return num
