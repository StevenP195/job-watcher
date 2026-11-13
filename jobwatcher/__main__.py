"""Command line entry point.

    python -m jobwatcher run      fetch every source, build history + status, open the daily issue
    python -m jobwatcher fetch    only call the sources and save raw files
    python -m jobwatcher build    rebuild data/history.csv and data/status.json from the raw files
    python -m jobwatcher issue    open / update today's GitHub issue from the current data
    python -m jobwatcher market   print the Market page numbers computed in Python (cross-check)
    python -m jobwatcher serve    serve the site at http://localhost:8000
"""

import argparse
import os
from pathlib import Path

from . import config, fetch, history, issues, status


def cmd_build():
    rows = history.build()
    history.write_csv(rows)
    st = status.build_status(rows)
    status.write_status(st)
    print(f"history.csv: {len(rows)} postings ({st['open']} open); "
          f"new today {st['new_today']}, removed today {st['removed_today']}, "
          f"{st['days_with_success']} day(s) of raw files")
    return history.read_csv(), st


def cmd_issue(rows=None, st=None):
    if rows is None:
        rows, st = history.read_csv(), status.build_status(history.read_csv())
    date = max(history.raw_days(config.RAW)) if history.raw_days(config.RAW) else ""
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    site = f"https://{repo.split('/')[0].lower()}.github.io/{repo.split('/')[1]}/" if "/" in repo else ""
    chunks = issues.render(date, rows, st, site)
    out = config.ROOT / "build" / "issue.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n\n---\n\n".join(chunks), encoding="utf-8")
    issues.publish(date, chunks)


def cmd_serve(port=8000):
    import functools
    import http.server
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(config.ROOT))
    print(f"Serving {config.ROOT} at http://localhost:{port}  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()


def main():
    p = argparse.ArgumentParser(prog="jobwatcher")
    p.add_argument("command", choices=["run", "fetch", "build", "issue", "market", "serve"])
    p.add_argument("--port", type=int, default=8000)
    a = p.parse_args()
    if a.command in ("run", "fetch"):
        fetch.fetch_all()
    if a.command in ("run", "build"):
        rows, st = cmd_build()
        if a.command == "run":
            cmd_issue(rows, st)
    elif a.command == "issue":
        cmd_issue()
    elif a.command == "market":
        from .market import report
        report(history.read_csv())
    elif a.command == "serve":
        cmd_serve(a.port)


if __name__ == "__main__":
    main()
