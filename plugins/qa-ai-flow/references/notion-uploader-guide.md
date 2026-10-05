# Notion Test Case Uploader

Uploads test cases from a JSON file into a Notion database via the Notion API.

---

## Requirements

- Python 3.7+
- `requests` library

```bash
pip install requests
```

---

## Setup

### 1. Get your Notion credentials

**NOTION_TOKEN** — create an integration at https://www.notion.so/my-integrations, then copy the Internal Integration Secret (starts with `ntn_` or `secret_`).

**NOTION_DATABASE_ID** — open your database in Notion, copy the ID from the URL:
```
https://www.notion.so/workspace/<DATABASE_ID>?v=...
```
Extract the 32-character hex string (no hyphens needed if already without them).

Then share the database with your integration:  
Database → **Share** → search for your integration name → **Invite**.

### 2. Create `.env` file

```env
NOTION_TOKEN=ntn_your_token_here
NOTION_DATABASE_ID=your_database_id_here
```

> Values may be wrapped in quotes — both `KEY=value` and `KEY="value"` are supported.

### 3. Set up your Notion database

The database **must** have these exact property names and types:

| Property Name   | Type          | Notes                          |
|----------------|---------------|--------------------------------|
| Test Case Name  | Title         | Main title column              |
| TC ID           | Text          | Machine key — do not create as auto-ID, do not edit manually. Assigned automatically at generation time (`TC-001`, zero-padded) and used to map spec/Playwright results back to this page. See "Syncing Results Back" below. |
| Module          | Multi-select  |                                |
| Type            | Multi-select  |                                |
| Status Chrome   | Status        | Options must include "Not started" |
| Status Firefox  | Status        | Options must include "Not started" |
| Status Safari   | Status        | Options must include "Not started" |
| Status Automation | Status      | Options: "Not started" / "Pass" / "Fail" / "Skipped". Written only by `update_test_results.py` (see "Syncing Results Back" below) — never set manually. |
| Source Requirement | Text        | Optional — requirement id(s) this TC traces to, e.g. `US-C-007.2` or `REQ-3`. Empty when the TC wasn't generated from a PRD. |
| Source Type      | Select        | Optional — `figma` / `prd` / `figma+prd`. Defaults to `figma` for TCs generated the original screenshot-only way. |

**Why these two are real Notion columns, not just JSON metadata:** this is a
lightweight Requirements Traceability Matrix (RTM). Standard QA practice is
that traceability stays queryable for the life of the test case — coverage
reporting, impact analysis when a requirement changes, an audit trail —
not just as a one-time check during generation. A link that only exists in
the generation-session chat transcript stops being useful the moment the TC
is uploaded, so these two fields are written as first-class columns instead
of the "optional, not written to Notion" pattern used for `automatable`.

The following fields are written **inside the page body** (not as database columns):
- Expected Result
- Steps to Reproduce
- Test Data
- Prerequisites
- Note

---

## Who edits what

`testcases.json` is the source of truth for what a test case *says*. Notion is
where the team records what *happened* when it was tested.

| Column | Who writes it | Edit by hand in Notion? |
|---|---|---|
| Status Chrome / Firefox / Safari | QA, after manual testing | **Yes** — this is its purpose. Scripts never overwrite it. |
| Status Automation | `update_test_results.py` | **No** — the next sync overwrites it. |
| TC ID | Generator (`TC-001`) | **No** — it links the page to specs and results. Changing it breaks result sync. |
| Automatable (optional column) | Generator, via `testcases.json` | **No** — change it in `testcases.json` or by re-check, then `--update`. |
| Test Case Name, Module, Type, Source Requirement, Source Type | Generator | **No** — `--update` overwrites them. |
| Page body (Expected Result, Steps, Test Data, Prerequisites, Note) | Generator | **No** — `--update` replaces the body, so manual edits are lost. |

**Changing a test case's content** (steps, expected result): do it through
`figma-testcase-generator` re-check mode, then run `--update --tc-ids ...`.
Do not edit the Notion page, or the next update erases the change.

**Manual and automated runs side by side:** record the manual result in
`Status Chrome/Firefox/Safari` and let the sync fill `Status Automation`. If
the two disagree (manual Pass, Automation Fail) it usually points to a
selector or script problem, not a product bug.

**Not automatable?** A test case with `Automatable: No` is still tracked and
tested manually like any other; it is simply skipped by
`playwright-from-testcases` and listed under "Manual-only".

---

## JSON Format

Prepare a file named `testcases.json` at the repo root (project root — see `--input` below). It must be a JSON array where each item has this structure:

```json
[
  {
    "tc_id": "TC-001",
    "title": "Login fails when password field is empty",
    "module": "Login",
    "type": "Validation",
    "automatable": "Yes",
    "status_chrome": "Not started",
    "status_firefox": "Not started",
    "status_safari": "Not started",
    "expected_result": "Form shows validation error and login is blocked",
    "steps_to_reproduce": [
      "Navigate to the login page",
      "Leave the password field empty",
      "Click the Login button"
    ],
    "test_data": "Email: test@example.com, Password: (empty)",
    "prerequisites": "User is on the login page",
    "note": "",
    "source_requirement": "",
    "source_type": "figma"
  }
]
```

### Field reference

| Field               | Type             | Required | Description                              |
|--------------------|------------------|----------|------------------------------------------|
| `tc_id`             | string           | ✅       | Machine key, format `TC-001` (zero-padded). Maps to **TC ID** column. Auto-assigned at generation time — never edited manually. |
| `title`             | string           | ✅       | Test case name — maps to **Test Case Name** column |
| `module`            | string           | ✅       | Maps to **Module** column (multi-select) |
| `type`              | string           | ✅       | Maps to **Type** column (multi-select)   |
| `automatable`       | string           | —       | `"Yes"` or `"No"`. Used by the `playwright-from-testcases` skill to decide which TCs to automate; not written to a Notion column. |
| `status_chrome`     | string           | ✅       | Must match an existing Status option (e.g. `"Not started"`) |
| `status_firefox`    | string           | ✅       | Same as above                            |
| `status_safari`     | string           | ✅       | Same as above                            |
| `expected_result`   | string           | ✅       | Written in page body                     |
| `steps_to_reproduce`| array of strings | ✅       | Written as numbered list in page body    |
| `test_data`         | string           | ✅       | Written in page body                     |
| `prerequisites`     | string           | ✅       | Written in page body                     |
| `note`              | string           | —        | Written in page body, can be empty `""` |
| `source_requirement`| string           | —        | Requirement id(s) this TC traces to — PRD-native (`US-C-007.2`) when the PRD numbers its own requirements, otherwise minted (`REQ-3`). Maps to the **Source Requirement** column. Empty `""` if no PRD was used. |
| `source_type`       | string           | —        | `"figma"` \| `"prd"` \| `"figma+prd"` — maps to **Source Type** column. Defaults to `"figma"` if omitted. |

---

## Usage

Run `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --help` for the full flag list.

### Upload all test cases

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py
```

### Upload a limited number (for testing)

```bash
# Upload only the first 1
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --limit 1

# Upload only the first 5
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --limit 5
```

> **Tip:** Always run with `--limit 1` first to verify the integration is working correctly before uploading in bulk.

### Dry run (no pages created)

Preview what would be uploaded without actually creating any pages:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --dry-run

# Combine with limit
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --dry-run --limit 5
```

### Custom input path

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --input path/to/testcases.json
```

---

## Idempotency / dedup

Before uploading, the script queries the database for every `TC ID` already
present and **skips any test case whose `tc_id` already exists** — running
the script twice on the same input does not create duplicate pages. This is
on by default; no flag needed.

- `--list` — just print the TC IDs currently in the database and exit (no upload). Use this to answer "is this database already populated?" without hand-rolling a Notion API query.
- `--force` — bypass the dedup check and create pages even for TC IDs that already exist. Use only if you intentionally want duplicates.

```bash
# Check what's already there
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --list

# Upload normally (existing TC IDs are skipped automatically)
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py

# Force-create duplicates anyway
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --force
```

The script also warns (non-blocking) if any test case in the input is
missing `tc_id` or `automatable` — those fields are required for later
Notion-sync and Step 3 automation to work; regenerate the input file if you
see this warning.

---

## Updating existing pages

When a re-check pass (the `figma-testcase-generator` skill's re-check mode)
revises test cases that are already in Notion, `--update` patches the
matching pages in place instead of skipping them or creating duplicates:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --update --tc-ids TC-045,TC-046
```

- **`--tc-ids` is required alongside `--update`** — it scopes the run to an
  explicit, small set of TC IDs (typically the ones a re-check session's
  end-of-session Traceability Summary listed as revised/added). Running
  `--update` without `--tc-ids` errors immediately, before any API calls;
  an ID not found in the local input file also errors immediately.
- **`--update` and `--force` are mutually exclusive** — they express
  contradictory intent (`--force` always creates/duplicates, `--update`
  patches an existing page in place); combining them errors immediately.
- For each scoped TC ID: if no matching page exists in Notion yet, it's
  created as normal (same as a plain upload). If a matching page exists,
  its properties are PATCHed and its body content (Expected Result, Steps
  to Reproduce, Test Data, Prerequisites, Note) is replaced by appending
  the new blocks and then archiving the old ones. That ordering is
  deliberate: if the archive step fails partway through, the page is left
  with old + new content stacked (messy, but nothing is lost) rather than
  briefly empty. Re-running `--update` with the same `--tc-ids` is
  self-healing — it picks up whatever's currently on the page, appends one
  more fresh copy, and archives everything it just saw, converging on just
  the latest copy with no manual cleanup needed.
- **Manual QA status is never touched.** `--update` replaces only body
  content, title, module, type, and `Source Requirement`/`Source Type` —
  it never sends `Status Chrome`, `Status Firefox`, or `Status Safari`,
  even though the local `testcases.json` always carries those fields
  hardcoded to `"Not started"`. Those three columns are QA-maintained
  (overwriting them with automation results would destroy manual test
  records), so a status a
  QA set by hand in the Notion UI survives a re-check's `--update`
  untouched.
- Combine with `--dry-run` to preview without writing:
  ```bash
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --update --tc-ids TC-045,TC-046 --dry-run
  ```

---

## Output

```
Loaded 261 test cases from testcases.json.
Checking for existing TC IDs in database 2f8ae2ee...
Found 12 existing TC ID(s) already in the database.

Uploading 261 test case(s) to Notion database 2f8ae2ee...

[  1/261] Create Blog Post entry fails when summary field is empty
         ⏭ Skipped — TC-001 already exists in Notion
[  2/261] Remove gallery component from Blog Post entry
         ✓ Created

============================================================
Done. ✓ 249 created  ↻ 0 updated  ⏭ 12 skipped (existing)  ✗ 0 failed  (total: 261)
```

---

## Syncing Results Back

After Step 3 (Playwright automation) runs, `update_test_results.py` pushes
pass/fail results back to Notion — into a **separate** `Status Automation`
column, not the manual `Status Chrome/Firefox/Safari` columns. This keeps
manual QA records and automation results visible side-by-side: e.g.
`Status Chrome: Pass` (manual) + `Status Automation: Fail` signals a
selector/script issue, not a real product bug.

### 1. Add the `Status Automation` column

In your Notion database, add a new property:

| Property Name      | Type   | Options                                      |
|--------------------|--------|-----------------------------------------------|
| Status Automation  | Status | `Not started`, `Pass`, `Fail`, `Skipped`      |

### 2. Run Playwright with the JSON reporter

```bash
cd e2e
npx playwright test --reporter=json > playwright-report/results.json
cd ..
```

### 3. Run the sync script

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/update_test_results.py
```

Run from the project root. By default it reads
`e2e/playwright-report/results.json` and scans `e2e/tests` for `// TC-001`-style comments to
map each test back to its Notion page via the `TC ID` column. Override either
path if your layout differs:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/update_test_results.py --results e2e/playwright-report/results.json --specs-dir e2e/tests
```

### 4. Preview without writing

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/update_test_results.py --dry-run
```

### How the mapping works

```
e2e/tests/*.spec.ts  (// TC-001 comment above each test())
  → update_test_results.py parses the comment + matches it to the Playwright
    JSON report's test title
      → queries Notion for the page where TC ID == TC-001
          → PATCHes only that page's Status Automation property
```

A test with no `// TC-xxx` comment above it is reported as untraceable and
skipped — it is never silently dropped, and never causes a mismatch write to
the wrong page.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` — API token is invalid | Token is wrong, expired, or had quotes stripped incorrectly | Re-copy the token from https://www.notion.so/my-integrations |
| `404 Not Found` | Wrong database ID | Double-check the ID from the database URL |
| `403 Forbidden` | Integration not connected to the database | Open the database → Share → invite your integration |
| `validation_error` — property not found | Database is missing a required column or has wrong type | Check property names and types match the table above exactly |
| `validation_error` — invalid status option | Status value in JSON doesn't match Notion's option name | Check your Status column options in Notion and update the JSON values to match |
| Rate limit `429` | Too many requests | Script handles this automatically with retry + backoff |
