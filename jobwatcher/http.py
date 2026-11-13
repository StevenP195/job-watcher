"""Small JSON-over-HTTP helper (standard library only) with retries."""

import json
import time
import urllib.error
import urllib.request

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; job-watcher class project)",
    "Accept": "application/json",
    "Content-Type": "application/json",
}


def request_json(url, body=None, retries=3, timeout=45):
    data = json.dumps(body).encode() if body is not None else None
    method = "POST" if data is not None else "GET"
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            last = e
            # 4xx other than rate limiting will not get better on retry
            if 400 <= e.code < 500 and e.code != 429:
                break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = e
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{method} {url} failed: {last}")
