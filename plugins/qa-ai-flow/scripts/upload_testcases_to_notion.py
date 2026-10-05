#!/usr/bin/env python3
"""
Upload testcases.json to a Notion database.

Required env vars (set in .env or shell):
  NOTION_TOKEN       - Notion integration secret (secret_xxx)
  NOTION_DATABASE_ID - Target database ID (32-char hex or URL UUID)

Notion DB must have these properties (exact names, exact types):
  Test Case Name     - title
  Module             - multi_select
  Type               - multi_select
  Status Chrome      - status
  Status Firefox     - status
  Status Safari      - status
  TC ID               - rich_text (machine key, do not recreate as auto-ID)
  Source Requirement - rich_text (optional; empty when no PRD was used)
  Source Type        - select (optional; "figma" / "prd" / "figma+prd")
  Automatable        - select, options "Yes" / "No" (optional; written only
                       when this column exists in the database — detected at
                       startup, so databases without it keep working)

The following fields are written as page body content (not DB columns):
  Expected Result, Steps to Reproduce, Test Data, Prerequisites, Note
"""

import argparse
import json
import os
import sys
import time

import requests

# ---------------------------------------------------------------------------
# Minimal .env loader (no python-dotenv needed)
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
INPUT_FILE = "testcases.json"  # run from the project root; override with --input
NOTION_VERSION = "2022-06-28"
BASE_URL = "https://api.notion.com/v1"

# Notion API rate limit ~3 req/s; 0.35s gap keeps us safe
REQUEST_DELAY = 0.35
MAX_RETRIES = 3

# QA-maintained status columns — never touched by automation (see
# "Overwriting those with automation
# results would destroy manual test records"). Every generator hardcodes
# these to "Not started" in the local JSON, so sending them unconditionally
# on --update would silently wipe real QA execution history.
UPDATE_EXCLUDED_PROPERTIES = {"Status Chrome", "Status Firefox", "Status Safari"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def headers():
    return {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
    }

def rich_text(value: str) -> list:
    """Notion rich_text inline. Truncate to 2000 chars (API limit)."""
    text = str(value or "")[:2000]
    return [{"type": "text", "text": {"content": text}}]

def heading_block(text: str) -> dict:
    """Heading 3 block."""
    return {
        "object": "block",
        "type": "heading_3",
        "heading_3": {"rich_text": rich_text(text)},
    }

def paragraph_block(text: str) -> dict:
    """Paragraph block."""
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": rich_text(text)},
    }

def numbered_list_block(text: str) -> dict:
    """Numbered list item block."""
    return {
        "object": "block",
        "type": "numbered_list_item",
        "numbered_list_item": {"rich_text": rich_text(text)},
    }

def build_page_children(tc: dict) -> list:
    """Build page body blocks for fields that live inside the page."""
    blocks = []

    # Expected Result
    blocks.append(heading_block("Expected Result"))
    blocks.append(paragraph_block(tc.get("expected_result", "-")))

    # Steps to Reproduce
    blocks.append(heading_block("Steps to Reproduce"))
    steps = tc.get("steps_to_reproduce", [])
    if steps:
        for step in steps:
            blocks.append(numbered_list_block(str(step)))
    else:
        blocks.append(paragraph_block("-"))

    # Test Data
    blocks.append(heading_block("Test Data"))
    blocks.append(paragraph_block(tc.get("test_data", "-")))

    # Prerequisites
    blocks.append(heading_block("Prerequisites"))
    blocks.append(paragraph_block(tc.get("prerequisites", "-")))

    # Note
    blocks.append(heading_block("Note"))
    blocks.append(paragraph_block(tc.get("note", "-") or "-"))

    return blocks

# Set in main() after checking the database schema. Stays False when the
# database has no "Automatable" select column, so older databases don't
# fail with a validation_error.
AUTOMATABLE_COLUMN = False

def normalize_automatable(value):
    """Map the JSON `automatable` value to 'Yes' / 'No', or None if unusable."""
    text = str(value or "").strip().lower()
    if text.startswith("yes"):
        return "Yes"
    if text.startswith("no"):
        return "No"
    return None

def detect_automatable_column() -> bool:
    """Return True if the database has an 'Automatable' property of type select."""
    try:
        res = requests.get(f"{BASE_URL}/databases/{DB_ID}", headers=headers(), timeout=15)
        if res.status_code != 200:
            print(f"⚠️  Could not read database schema ({res.status_code}); "
                  f"skipping the optional Automatable column.")
            return False
        prop = res.json().get("properties", {}).get("Automatable")
        return bool(prop and prop.get("type") == "select")
    except requests.RequestException as e:
        print(f"⚠️  Could not read database schema ({e}); skipping the optional Automatable column.")
        return False

def build_page_payload(tc: dict) -> dict:
    payload = _build_page_payload_base(tc)
    if AUTOMATABLE_COLUMN:
        value = normalize_automatable(tc.get("automatable"))
        if value:
            payload["properties"]["Automatable"] = {"select": {"name": value}}
    return payload

def _build_page_payload_base(tc: dict) -> dict:
    return {
        "parent": {"database_id": DB_ID},
        "properties": {
            "Test Case Name": {
                "title": rich_text(tc.get("title", ""))
            },
            "TC ID": {
                "rich_text": rich_text(tc.get("tc_id", ""))
            },
            "Module": {
                "multi_select": [{"name": tc.get("module", "")}] if tc.get("module") else []
            },
            "Type": {
                "multi_select": [{"name": tc.get("type", "")}] if tc.get("type") else []
            },
            "Status Chrome": {
                "status": {"name": tc.get("status_chrome", "Not started")}
            },
            "Status Firefox": {
                "status": {"name": tc.get("status_firefox", "Not started")}
            },
            "Status Safari": {
                "status": {"name": tc.get("status_safari", "Not started")}
            },
            "Source Requirement": {
                "rich_text": rich_text(tc.get("source_requirement", ""))
            },
            "Source Type": {
                "select": {"name": tc.get("source_type") or "figma"}
            },
        },
        "children": build_page_children(tc),
    }

def parse_tc_ids(raw: str) -> list:
    """Parse a comma-separated --tc-ids value into a clean, ordered, deduped list."""
    seen = set()
    ids = []
    for part in raw.split(","):
        tc_id = part.strip()
        if tc_id and tc_id not in seen:
            seen.add(tc_id)
            ids.append(tc_id)
    return ids

def find_missing_tc_ids(tc_ids: list, testcases: list) -> list:
    """Return the subset of tc_ids that aren't present in testcases (likely typos)."""
    present = {tc.get("tc_id") for tc in testcases}
    return [tc_id for tc_id in tc_ids if tc_id not in present]

def query_existing_tc_ids() -> set:
    """Fetch every 'TC ID' value already present in the database, paginated.
    Used for default-on dedup: don't re-create a page for a TC ID that's
    already there."""
    existing = set()
    payload = {"page_size": 100}
    while True:
        try:
            res = requests.post(
                f"{BASE_URL}/databases/{DB_ID}/query", headers=headers(), json=payload, timeout=15
            )
        except requests.RequestException as e:
            print(f"    ✗ Query failed while checking existing pages: {e}")
            break
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 5))
            print(f"    ⚠ Rate limited while querying existing pages. Waiting {retry_after}s...")
            time.sleep(retry_after)
            continue
        if res.status_code != 200:
            print(f"    ✗ Query error {res.status_code}: {res.text[:200]}")
            break
        data = res.json()
        for page in data.get("results", []):
            rich = page.get("properties", {}).get("TC ID", {}).get("rich_text", [])
            text = "".join(t.get("plain_text", "") for t in rich).strip()
            if text:
                existing.add(text)
        if not data.get("has_more"):
            break
        payload["start_cursor"] = data.get("next_cursor")
        time.sleep(REQUEST_DELAY)
    return existing

def find_page_by_tc_id(tc_id: str, attempt: int = 1):
    """Query Notion for the single page with this exact TC ID. Returns page_id or None."""
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
            print(f"    ⚠ Multiple Notion pages found for {tc_id} — --update will only patch the first")
        return results[0]["id"]
    except requests.RequestException as e:
        print(f"    ✗ Request failed: {e}")
        if attempt <= MAX_RETRIES:
            time.sleep(2 ** attempt)
            return find_page_by_tc_id(tc_id, attempt + 1)
        return None

def get_page_children_ids(page_id: str, attempt: int = 1):
    """List a page's direct child block IDs, paginated.
    Returns a list (possibly empty, for a genuinely childless page) on
    success, or None on failure after retries are exhausted — the two
    cases are deliberately distinguishable so callers can tell "no
    children" apart from "couldn't find out" and abort instead of
    treating a listing failure as license to append on top of unknown
    existing content."""
    ids = []
    cursor = None
    while True:
        params = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        try:
            res = requests.get(
                f"{BASE_URL}/blocks/{page_id}/children", headers=headers(), params=params, timeout=15
            )
        except requests.RequestException as e:
            print(f"    ✗ Request failed while listing page children: {e}")
            if attempt <= MAX_RETRIES:
                time.sleep(2 ** attempt)
                return get_page_children_ids(page_id, attempt + 1)
            return None
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 5))
            print(f"    ⚠ Rate limited while listing page children. Waiting {retry_after}s...")
            time.sleep(retry_after)
            if attempt <= MAX_RETRIES:
                return get_page_children_ids(page_id, attempt + 1)
            return None
        if res.status_code != 200:
            print(f"    ✗ Error {res.status_code} listing page children: {res.text[:200]}")
            return None
        data = res.json()
        ids.extend(block["id"] for block in data.get("results", []))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
        time.sleep(REQUEST_DELAY)
    return ids

def append_page_children(page_id: str, blocks: list, attempt: int = 1) -> bool:
    """Append new body blocks to a page. Notion caps a single append at 100 blocks —
    this tool's body content (Expected Result/Steps/Test Data/Prerequisites/Note) is
    always far under that, so no chunking is implemented."""
    try:
        res = requests.patch(
            f"{BASE_URL}/blocks/{page_id}/children",
            headers=headers(),
            json={"children": blocks},
            timeout=15,
        )
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 5))
            print(f"    ⚠ Rate limited while appending page children. Waiting {retry_after}s...")
            time.sleep(retry_after)
            if attempt <= MAX_RETRIES:
                return append_page_children(page_id, blocks, attempt + 1)
            return False
        if res.status_code not in (200, 201):
            print(f"    ✗ Error {res.status_code} appending page children: {res.text[:200]}")
            return False
        return True
    except requests.RequestException as e:
        print(f"    ✗ Request failed while appending page children: {e}")
        if attempt <= MAX_RETRIES:
            time.sleep(2 ** attempt)
            return append_page_children(page_id, blocks, attempt + 1)
        return False

def archive_block(block_id: str, attempt: int = 1) -> bool:
    """Archive (soft-delete) a single block."""
    try:
        res = requests.patch(
            f"{BASE_URL}/blocks/{block_id}", headers=headers(), json={"archived": True}, timeout=15
        )
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 5))
            print(f"    ⚠ Rate limited while archiving block. Waiting {retry_after}s...")
            time.sleep(retry_after)
            if attempt <= MAX_RETRIES:
                return archive_block(block_id, attempt + 1)
            return False
        if res.status_code != 200:
            print(f"    ✗ Error {res.status_code} archiving block {block_id}: {res.text[:200]}")
            return False
        return True
    except requests.RequestException as e:
        print(f"    ✗ Request failed while archiving block {block_id}: {e}")
        if attempt <= MAX_RETRIES:
            time.sleep(2 ** attempt)
            return archive_block(block_id, attempt + 1)
        return False

def patch_page_properties(page_id: str, properties: dict, attempt: int = 1) -> bool:
    try:
        res = requests.patch(
            f"{BASE_URL}/pages/{page_id}", headers=headers(), json={"properties": properties}, timeout=15
        )
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 5))
            print(f"    ⚠ Rate limited while patching properties. Waiting {retry_after}s...")
            time.sleep(retry_after)
            if attempt <= MAX_RETRIES:
                return patch_page_properties(page_id, properties, attempt + 1)
            return False
        if res.status_code not in (200, 201):
            print(f"    ✗ Error {res.status_code} patching properties: {res.text[:200]}")
            return False
        return True
    except requests.RequestException as e:
        print(f"    ✗ Request failed while patching properties: {e}")
        if attempt <= MAX_RETRIES:
            time.sleep(2 ** attempt)
            return patch_page_properties(page_id, properties, attempt + 1)
        return False

def upsert_page(page_id: str, tc: dict) -> bool:
    """Patch an existing page's properties and replace its body content.
    Ordering is append-then-archive (not archive-then-append): if this
    fails partway, the page ends up with old+new content stacked, never
    empty — and a re-run of --update against the same tc_id self-heals,
    since the next run's get_page_children_ids() picks up whatever is
    left over and archives it after appending one more fresh copy.

    Status Chrome/Firefox/Safari are QA-maintained and excluded from the
    properties PATCH (see UPDATE_EXCLUDED_PROPERTIES) — --update must
    never overwrite a manually recorded execution status."""
    full_payload = build_page_payload(tc)
    properties = {
        key: value
        for key, value in full_payload["properties"].items()
        if key not in UPDATE_EXCLUDED_PROPERTIES
    }

    if not patch_page_properties(page_id, properties):
        return False
    time.sleep(REQUEST_DELAY)

    old_block_ids = get_page_children_ids(page_id)
    time.sleep(REQUEST_DELAY)
    if old_block_ids is None:
        # Listing failed after retries — we don't know what's currently on
        # the page. Abort here, before append_page_children() does anything
        # destructive-adjacent (appending on top of unknown content would
        # leave old+new stacked with no way to know what to archive).
        print(f"    ✗ Could not list existing page content for {page_id} — aborting update "
              f"(nothing was changed; re-run --update to retry).")
        return False

    if not append_page_children(page_id, full_payload["children"]):
        return False
    time.sleep(REQUEST_DELAY)

    all_archived = True
    for block_id in old_block_ids:
        if not archive_block(block_id):
            all_archived = False
        time.sleep(REQUEST_DELAY)

    return all_archived

def create_page(tc: dict, attempt: int = 1) -> bool:
    payload = build_page_payload(tc)
    try:
        res = requests.post(f"{BASE_URL}/pages", headers=headers(), json=payload, timeout=15)
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 5))
            print(f"    ⚠ Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            if attempt <= MAX_RETRIES:
                return create_page(tc, attempt + 1)
            return False
        if res.status_code not in (200, 201):
            print(f"    ✗ Error {res.status_code}: {res.text[:200]}")
            return False
        return True
    except requests.RequestException as e:
        print(f"    ✗ Request failed: {e}")
        if attempt <= MAX_RETRIES:
            time.sleep(2 ** attempt)
            return create_page(tc, attempt + 1)
        return False

def parse_args():
    parser = argparse.ArgumentParser(description="Upload testcases.json to a Notion database.")
    parser.add_argument("--input", default=INPUT_FILE, help=f"Input JSON path (default: {INPUT_FILE})")
    parser.add_argument("--dry-run", action="store_true", help="Don't create any pages, just show what would happen")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N test cases")
    parser.add_argument("--force", action="store_true",
                         help="Create pages even if a TC ID already exists in the database (skips dedup check)")
    parser.add_argument("--list", action="store_true",
                         help="List TC IDs already present in the database and exit (no upload)")
    parser.add_argument("--update", action="store_true",
                         help="Patch existing Notion pages in place instead of skipping them "
                              "(requires --tc-ids; properties + body content both get replaced)")
    parser.add_argument("--tc-ids", default=None,
                         help="Comma-separated TC IDs to scope --update to, e.g. TC-045,TC-046 "
                              "(required alongside --update)")
    return parser.parse_args()

def validate_flags(args):
    if args.update and args.force:
        print("ERROR: --update and --force cannot be combined (contradictory: "
              "--force always creates/duplicates, --update patches existing pages in place).")
        sys.exit(1)
    if bool(args.update) != bool(args.tc_ids):
        print("ERROR: --update and --tc-ids must be used together "
              "(--update requires --tc-ids to scope which pages it touches; "
              "--tc-ids currently only has an effect in --update mode).")
        sys.exit(1)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    args = parse_args()
    validate_flags(args)

    # Validate config
    if not TOKEN:
        print("ERROR: NOTION_TOKEN not set. Add it to .env or export it.")
        sys.exit(1)
    if not DB_ID:
        print("ERROR: NOTION_DATABASE_ID not set. Add it to .env or export it.")
        sys.exit(1)

    global AUTOMATABLE_COLUMN
    AUTOMATABLE_COLUMN = detect_automatable_column()
    print(f"Automatable column: {'found, will be written' if AUTOMATABLE_COLUMN else 'not found, skipped'}")

    if args.list:
        print(f"Querying existing TC IDs in database {DB_ID[:8]}...")
        existing = query_existing_tc_ids()
        print(f"\n{len(existing)} TC ID(s) already in the database:")
        for tc_id in sorted(existing):
            print(f"  {tc_id}")
        return

    # Load test cases
    if not os.path.exists(args.input):
        print(f"ERROR: {args.input} not found.")
        sys.exit(1)

    with open(args.input) as f:
        testcases = json.load(f)

    total = len(testcases)
    print(f"Loaded {total} test cases from {args.input}.")

    # Staleness warning: flag TCs missing fields Step 3 automation / Notion
    # sync depend on (see IMP2-05). Non-blocking — some users may have
    # hand-written JSON without these fields.
    missing_fields_count = sum(
        1 for tc in testcases if not tc.get("tc_id") or "automatable" not in tc
    )
    if missing_fields_count:
        print(f"⚠️  {missing_fields_count} of {total} test case(s) are missing tc_id/automatable — "
              f"these won't be traceable to Notion updates or Step 3 automation. "
              f"Recommend regenerating {args.input} first.")

    if args.tc_ids:
        scoped_tc_ids = parse_tc_ids(args.tc_ids)
        missing = find_missing_tc_ids(scoped_tc_ids, testcases)
        if missing:
            print(f"ERROR: --tc-ids has {len(missing)} ID(s) not found in {args.input}: {', '.join(missing)}")
            sys.exit(1)
        testcases = [tc for tc in testcases if tc.get("tc_id") in set(scoped_tc_ids)]
        total = len(testcases)
        print(f"Scoped to {total} test case(s) via --tc-ids.")

    if args.dry_run:
        if args.update:
            print("DRY RUN — no pages will be created or updated.\n")
        else:
            print("DRY RUN — no pages will be created.\n")

    if args.limit:
        testcases = testcases[:args.limit]
        total = len(testcases)
        print(f"Limiting to {args.limit} test case(s).")

    # Dedup check (default-on): skip TCs whose tc_id already exists in Notion.
    existing_ids = set()
    if not args.force and not args.dry_run and not args.update:
        print(f"Checking for existing TC IDs in database {DB_ID[:8]}...")
        existing_ids = query_existing_tc_ids()
        print(f"Found {len(existing_ids)} existing TC ID(s) already in the database.\n")

    print(f"Uploading {total} test case(s) to Notion database {DB_ID[:8]}...\n")

    ok = 0
    updated = 0
    fail = 0
    skipped = 0

    for i, tc in enumerate(testcases, 1):
        title = tc.get("title", f"Test Case #{i}")
        tc_id = tc.get("tc_id", "")
        print(f"[{i:3}/{total}] {title[:70]}{'...' if len(title) > 70 else ''}")

        if args.update:
            if args.dry_run:
                payload = build_page_payload(tc)
                print(f"         → would check if {tc_id} exists in Notion; "
                      f"if yes: PATCH properties + replace body "
                      f"({len(payload['children'])} new block(s)); "
                      f"if no: CREATE ({len(json.dumps(payload))} bytes)")
                ok += 1
                continue

            page_id = find_page_by_tc_id(tc_id)
            time.sleep(REQUEST_DELAY)
            if page_id:
                success = upsert_page(page_id, tc)
                if success:
                    updated += 1
                    print(f"         ↻ Updated")
                else:
                    fail += 1
                continue
            # not found in Notion — fall through to plain create below

        if tc_id and tc_id in existing_ids:
            print(f"         ⏭ Skipped — {tc_id} already exists in Notion")
            skipped += 1
            continue

        if args.dry_run:
            payload = build_page_payload(tc)
            print(f"         → would POST: {len(json.dumps(payload))} bytes, {len(payload['children'])} body blocks")
            ok += 1
            continue

        success = create_page(tc)
        if success:
            ok += 1
            print(f"         ✓ Created")
        else:
            fail += 1

        time.sleep(REQUEST_DELAY)

    print(f"\n{'='*60}")
    print(f"Done. ✓ {ok} created  ↻ {updated} updated  ⏭ {skipped} skipped (existing)  ✗ {fail} failed  (total: {total})")
    if fail:
        sys.exit(1)

if __name__ == "__main__":
    main()
