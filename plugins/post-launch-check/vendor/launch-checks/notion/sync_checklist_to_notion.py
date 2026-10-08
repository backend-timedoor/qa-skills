#!/usr/bin/env python3
"""
Sync a launch-check report to a Notion checklist database (separate from the
test-case database used by upload_testcases_to_notion.py).

Env vars (set in .env or shell):
  NOTION_TOKEN              - Notion integration secret
  NOTION_CHECKLIST_DB_ID    - Target checklist database ID

Notion DB must have these properties (exact names, exact types):
  Check          - title
  Key            - rich_text (site|phase|run date|row id; machine key)
  ID, Site, Pages affected, Evidence, Reviewer - rich_text
  Run date       - date
  Phase, Group, Status - select

Usage (run from the project root):
  python3 sync_checklist_to_notion.py sync <run_dir> [--dry-run]
  python3 sync_checklist_to_notion.py pull <run_dir>
"""

import argparse
import json
import os
import sys
import time

STATUSES = ["pass", "fail", "review-needed", "manual-todo", "n/a", "error"]
PLACEHOLDER_STATUSES = {None, "manual-todo", "review-needed"}
NOTION_VERSION = "2022-06-28"
BASE_URL = "https://api.notion.com/v1"
REQUEST_DELAY = 0.35
MAX_RETRIES = 3
MAX_TEXT = 2000


def _load_env(path=".env"):
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


class NotionClient:
    def __init__(self, token):
        self.token = token

    def request(self, method, path, body=None):
        import requests

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION,
        }
        for attempt in range(MAX_RETRIES):
            time.sleep(REQUEST_DELAY)
            r = requests.request(method, BASE_URL + path, headers=headers, json=body, timeout=30)
            if r.status_code == 429 and attempt < MAX_RETRIES - 1:
                time.sleep(float(r.headers.get("Retry-After", "2")))
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"Notion {method} {path} failed: HTTP {r.status_code} {r.text[:300]}")
            return r.json()


def page_key(meta, row_id):
    return f"{meta['site']}|{meta['phase']}|{meta['runDate']}|{row_id}"


def _rt(text):
    return {"rich_text": [{"text": {"content": (text or "")[:MAX_TEXT]}}]}


def build_properties(row, meta, key):
    return {
        "Check": {"title": [{"text": {"content": row["check"][:200]}}]},
        "Key": _rt(key),
        "ID": _rt(row["id"]),
        "Run date": {"date": {"start": meta["runDate"]}},
        "Phase": {"select": {"name": meta["phase"]}},
        "Site": _rt(meta["site"]),
        "Group": {"select": {"name": row["group"]}},
        "Status": {"select": {"name": row["status"]}},
        "Pages affected": _rt(", ".join(row.get("pages", []))),
        "Evidence": _rt(row.get("reason", "")),
        "Reviewer": _rt(""),
    }


def update_properties(row, meta, key, existing_status):
    props = build_properties(row, meta, key)
    del props["Reviewer"]
    if existing_status not in PLACEHOLDER_STATUSES and row.get("type") != "auto":
        del props["Status"]
    return props


def _status_of(page):
    sel = page["properties"].get("Status", {}).get("select")
    return sel["name"] if sel else None


def _find_page(client, db_id, key):
    res = client.request("POST", f"/databases/{db_id}/query", {
        "filter": {"property": "Key", "rich_text": {"equals": key}}, "page_size": 1})
    return res["results"][0] if res["results"] else None


def sync_report(report, client, db_id, dry_run=False):
    meta = {k: report[k] for k in ("site", "phase", "runDate")}
    created = updated = 0
    actions = []
    for row in report["rows"]:
        key = page_key(meta, row["id"])
        existing = _find_page(client, db_id, key)
        if existing is None:
            created += 1
            actions.append(f"would create {row['id']}" if dry_run else f"created {row['id']}")
            if not dry_run:
                client.request("POST", "/pages", {
                    "parent": {"database_id": db_id}, "properties": build_properties(row, meta, key)})
        else:
            updated += 1
            actions.append(f"would update {row['id']}" if dry_run else f"updated {row['id']}")
            if not dry_run:
                client.request("PATCH", f"/pages/{existing['id']}", {
                    "properties": update_properties(row, meta, key, _status_of(existing))})
    return {"created": created, "updated": updated, "actions": actions}


def _text(prop):
    return "".join(t.get("plain_text", "") for t in prop.get("rich_text", []))


def pull_report(report, client, db_id):
    flt = {"and": [
        {"property": "Site", "rich_text": {"equals": report["site"]}},
        {"property": "Phase", "select": {"equals": report["phase"]}},
        {"property": "Run date", "date": {"equals": report["runDate"]}},
    ]}
    rows = {r["id"]: r for r in report["rows"]}
    changed = 0
    cursor = None
    while True:
        body = {"filter": flt, "page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        res = client.request("POST", f"/databases/{db_id}/query", body)
        for page in res["results"]:
            row = rows.get(_text(page["properties"].get("ID", {})))
            status = _status_of(page)
            if row is None or status not in STATUSES:
                continue
            reviewer = _text(page["properties"].get("Reviewer", {}))
            if row["status"] != status or row.get("reviewer", "") != reviewer:
                row["status"] = status
                if reviewer:
                    row["reviewer"] = reviewer
                changed += 1
        if not res.get("has_more"):
            break
        cursor = res.get("next_cursor")
    report["summary"] = {s: sum(1 for r in report["rows"] if r["status"] == s) for s in STATUSES}
    return {"changed": changed}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["sync", "pull"])
    ap.add_argument("run_dir")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    _load_env()
    token, db_id = os.environ.get("NOTION_TOKEN", ""), os.environ.get("NOTION_CHECKLIST_DB_ID", "")
    if not token or not db_id:
        print("NOTION_TOKEN and NOTION_CHECKLIST_DB_ID must be set (in .env or the shell).", file=sys.stderr)
        return 1

    path = os.path.join(args.run_dir, "report.json")
    with open(path) as f:
        report = json.load(f)
    client = NotionClient(token)

    if args.command == "sync":
        result = sync_report(report, client, db_id, dry_run=args.dry_run)
        for a in result["actions"]:
            print(a)
        print(f"{result['created']} created, {result['updated']} updated" + (" (dry run)" if args.dry_run else ""))
    else:
        result = pull_report(report, client, db_id)
        with open(path, "w") as f:
            json.dump(report, f, indent=2)
            f.write("\n")
        print(f"{result['changed']} row(s) changed. Run: node cli.js render {args.run_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
