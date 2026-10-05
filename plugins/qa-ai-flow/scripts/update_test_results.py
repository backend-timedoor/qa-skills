#!/usr/bin/env python3
"""
Sync Playwright test results back into Notion, without touching manual
status columns.

Reads Playwright's JSON reporter output (npx playwright test --reporter=json),
maps each test result back to its source test case via the `// TC-001`
comment convention (see the playwright-from-testcases skill),
and PATCHes only the `Status Automation` column on the matching Notion page.

`Status Chrome` / `Status Firefox` / `Status Safari` (manual test results)
are never touched by this script.

Required env vars (set in .env or shell):
  NOTION_TOKEN       - Notion integration secret (secret_xxx / ntn_xxx)
  NOTION_DATABASE_ID - Target database ID (32-char hex or URL UUID)

Notion DB must have this property (exact name, exact type):
  Status Automation  - status, options: "Not started" / "Pass" / "Fail" / "Skipped"

And already have (from upload_testcases_to_notion.py):
  TC ID              - rich_text, the machine key that links a spec test()
                        back to a Notion page

Usage:
  python3 update_test_results.py
  python3 update_test_results.py --results e2e/playwright-report/results.json
  python3 update_test_results.py --specs-dir e2e/tests
  python3 update_test_results.py --dry-run
"""

import argparse
import json
import os
import re
import sys
import time
import glob

import requests

# ---------------------------------------------------------------------------
# Minimal .env loader (no python-dotenv needed) - same as upload script
# ---------------------------------------------------------------------------
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

_load_env()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
TOKEN = os.environ.get("NOTION_TOKEN", "")
DB_ID = os.environ.get("NOTION_DATABASE_ID", "")
NOTION_VERSION = "2022-06-28"
BASE_URL = "https://api.notion.com/v1"

DEFAULT_RESULTS_FILE = os.environ.get("PLAYWRIGHT_JSON_REPORT", "e2e/playwright-report/results.json")
DEFAULT_SPECS_DIR = os.environ.get("SPECS_DIR", "e2e/tests")

REQUEST_DELAY = 0.35
MAX_RETRIES = 3

# Playwright test status -> Notion "Status Automation" option
STATUS_MAP = {
    "passed": "Pass",
    "failed": "Fail",
    "timedOut": "Fail",
    "interrupted": "Fail",
    "skipped": "Skipped",
}

TC_ID_RE = re.compile(
    r"//\s*(TC-\d+)[^\n]*\n\s*test(?:\.only|\.skip)?\(\s*[\'\"`]([^\'\"`]+)[\'\"`]"
)


def headers():
    return {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
    }


# ---------------------------------------------------------------------------
# Step 1: build test title -> tc_id map from spec files
# ---------------------------------------------------------------------------
def build_title_to_tcid_map(specs_dir: str) -> dict:
    mapping = {}
    files = glob.glob(os.path.join(specs_dir, "**", "*.spec.ts"), recursive=True)
    for filepath in files:
        try:
            with open(filepath, "r") as f:
                content = f.read()
        except Exception as e:
            print(f"    ⚠ Could not read {filepath}: {e}")
            continue
        for tc_id, title in TC_ID_RE.findall(content):
            if title in mapping and mapping[title] != tc_id:
                print(f"    ⚠ Duplicate test title '{title}' maps to both "
                      f"{mapping[title]} and {tc_id} — keeping {mapping[title]}")
                continue
            mapping[title] = tc_id
    return mapping


# ---------------------------------------------------------------------------
# Step 2: flatten Playwright JSON reporter output into (title, status) pairs
# ---------------------------------------------------------------------------
def flatten_specs(suite: dict, out: list):
    for spec in suite.get("specs", []):
        title = spec.get("title", "")
        for test in spec.get("tests", []):
            results = test.get("results", [])
            if not results:
                continue
            # last attempt is the effective outcome (handles retries)
            status = results[-1].get("status", "")
            out.append((title, status))
    for sub_suite in suite.get("suites", []):
        flatten_specs(sub_suite, out)


def load_test_results(results_file: str) -> list:
    with open(results_file) as f:
        report = json.load(f)
    out = []
    for suite in report.get("suites", []):
        flatten_specs(suite, out)
    return out


# ---------------------------------------------------------------------------
# Step 3: query Notion for the page with matching TC ID
# ---------------------------------------------------------------------------
def find_page_by_tc_id(tc_id: str, attempt: int = 1):
    payload = {
        "filter": {
            "property": "TC ID",
            "rich_text": {"equals": tc_id},
        }
    }
    try:
        res = requests.post(
            f"{BASE_URL}/databases/{DB_ID}/query",
            headers=headers(),
            json=payload,
            timeout=15,
        )
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 5))
            print(f"    ⚠ Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            if attempt <= MAX_RETRIES:
                return find_page_by_tc_id(tc_id, attempt + 1)
            return None
        if res.status_code != 200:
            print(f"    ✗ Query error {res.status_code}: {res.text[:200]}")
            return None
        results = res.json().get("results", [])
        if not results:
            return None
        if len(results) > 1:
            print(f"    ⚠ Multiple Notion pages found for {tc_id} — using the first")
        return results[0]["id"]
    except requests.RequestException as e:
        print(f"    ✗ Request failed: {e}")
        if attempt <= MAX_RETRIES:
            time.sleep(2 ** attempt)
            return find_page_by_tc_id(tc_id, attempt + 1)
        return None


# ---------------------------------------------------------------------------
# Step 4: patch only Status Automation
# ---------------------------------------------------------------------------
def patch_status_automation(page_id: str, status_value: str, attempt: int = 1) -> bool:
    payload = {
        "properties": {
            "Status Automation": {"status": {"name": status_value}}
        }
    }
    try:
        res = requests.patch(
            f"{BASE_URL}/pages/{page_id}", headers=headers(), json=payload, timeout=15
        )
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 5))
            print(f"    ⚠ Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            if attempt <= MAX_RETRIES:
                return patch_status_automation(page_id, status_value, attempt + 1)
            return False
        if res.status_code not in (200, 201):
            print(f"    ✗ Error {res.status_code}: {res.text[:200]}")
            return False
        return True
    except requests.RequestException as e:
        print(f"    ✗ Request failed: {e}")
        if attempt <= MAX_RETRIES:
            time.sleep(2 ** attempt)
            return patch_status_automation(page_id, status_value, attempt + 1)
        return False


def parse_args():
    parser = argparse.ArgumentParser(
        description="Sync Playwright test results back into Notion's Status Automation column."
    )
    parser.add_argument("--results", default=DEFAULT_RESULTS_FILE,
                         help=f"Playwright JSON reporter output path (default: {DEFAULT_RESULTS_FILE})")
    parser.add_argument("--specs-dir", default=DEFAULT_SPECS_DIR,
                         help=f"Directory to scan for // TC-xxx comments (default: {DEFAULT_SPECS_DIR})")
    parser.add_argument("--dry-run", action="store_true", help="Don't update any Notion pages, just show what would happen")
    return parser.parse_args()

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    args = parse_args()
    dry_run = args.dry_run
    results_file = args.results
    specs_dir = args.specs_dir

    if not TOKEN:
        print("ERROR: NOTION_TOKEN not set. Add it to .env or export it.")
        sys.exit(1)
    if not DB_ID:
        print("ERROR: NOTION_DATABASE_ID not set. Add it to .env or export it.")
        sys.exit(1)
    if not os.path.exists(results_file):
        print(f"ERROR: {results_file} not found. Run:")
        print("  npx playwright test --reporter=json > playwright-report/results.json")
        sys.exit(1)
    if not os.path.isdir(specs_dir):
        print(f"ERROR: specs dir {specs_dir} not found. Pass --specs-dir explicitly.")
        sys.exit(1)

    print(f"Scanning {specs_dir} for // TC-xxx comments...")
    title_to_tcid = build_title_to_tcid_map(specs_dir)
    print(f"Found {len(title_to_tcid)} traceable test(s).\n")

    print(f"Loading Playwright results from {results_file}...")
    test_results = load_test_results(results_file)
    print(f"Found {len(test_results)} test result(s) in report.\n")

    if dry_run:
        print("DRY RUN — no Notion pages will be updated.\n")

    updated = 0
    skipped_untraced = 0
    not_found = 0
    failed = 0

    for title, pw_status in test_results:
        tc_id = title_to_tcid.get(title)
        if not tc_id:
            skipped_untraced += 1
            print(f"[skip] No // TC-xxx comment found for test: {title[:70]}")
            continue

        status_value = STATUS_MAP.get(pw_status)
        if not status_value:
            print(f"[skip] Unknown Playwright status '{pw_status}' for {tc_id} — skipping")
            continue

        print(f"[{tc_id}] {title[:60]} -> {status_value}")

        if dry_run:
            updated += 1
            continue

        page_id = find_page_by_tc_id(tc_id)
        if not page_id:
            print(f"    ✗ No Notion page found for {tc_id}")
            not_found += 1
            continue

        time.sleep(REQUEST_DELAY)
        ok = patch_status_automation(page_id, status_value)
        if ok:
            updated += 1
            print("    ✓ Updated Status Automation")
        else:
            failed += 1
        time.sleep(REQUEST_DELAY)

    print(f"\n{'='*60}")
    print(
        f"Done. ✓ {updated} updated  ✗ {failed} failed  "
        f"⚠ {not_found} not found in Notion  ⏭ {skipped_untraced} untraceable"
    )
    if failed or not_found:
        sys.exit(1)


if __name__ == "__main__":
    main()
