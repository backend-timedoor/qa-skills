---
name: notion-testcase-uploader
description: Upload test cases from testcases.json to a Notion database (one page per test case), update pages after a re-check, and sync Playwright pass/fail results back into the Status Automation column. Use for "upload test cases to Notion", "push testcases.json to Notion", "update TC-045 in Notion", "sync Playwright results to Notion", "check what is already in Notion", or as Step 2 of the qa-ai-flow after figma-testcase-generator.
---

# Notion Test Case Uploader (Step 2)

Wraps two scripts in `${CLAUDE_PLUGIN_ROOT}/scripts/`. Always run them **from the project root**
(where `testcases.json` and `.env` live). Full reference (database columns, JSON fields, flags,
troubleshooting): `${CLAUDE_PLUGIN_ROOT}/references/notion-uploader-guide.md` — read it when a
column, flag or error needs detail.

## Preflight (every time)

1. `testcases.json` exists at the project root. If not, tell the user to run
   `figma-testcase-generator` first.
2. `.env` exists with `NOTION_TOKEN` and `NOTION_DATABASE_ID`. Check only that the keys are present
   (e.g. `grep -c '^NOTION_' .env`); **never print or ask for the values**. If missing, run
   `setup-qa-ai-flow`, or point the user to `${CLAUDE_PLUGIN_ROOT}/scripts/GET_NOTION_CREDENTIALS.md`.
   The database must also be shared with the integration.
3. `python3 -c "import requests"` works; otherwise `pip install -r ${CLAUDE_PLUGIN_ROOT}/requirements.txt`.

## Upload (new test cases)

Uploading writes to the user's Notion workspace. Don't run a real upload before they agree.

1. `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --list` — what's already there.
2. `... --dry-run` — preview; show the user the counts.
3. After confirmation, `... --limit 1` first on a new database, check the result with the user,
   then run without `--limit`.
   Existing `tc_id`s are skipped automatically, so re-running is safe. Don't use `--force` (creates
   duplicates) unless the user explicitly wants duplicates.

## Update (after a re-check revised test cases)

Only for TC IDs listed in the re-check's Traceability Summary, after the user confirms:

```
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --update --tc-ids TC-045,TC-046 --dry-run
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --update --tc-ids TC-045,TC-046
```

`--tc-ids` is required with `--update`, and `--update` cannot be combined with `--force`.
Manual `Status Chrome/Firefox/Safari` values are never overwritten.

## Sync Playwright results

Requires a `Status Automation` column (Status: Not started / Pass / Fail / Skipped) and specs with
`// TC-001` comments above each `test()`.

```
cd e2e && npx playwright test --reporter=json > playwright-report/results.json; cd ..
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/update_test_results.py --dry-run
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/update_test_results.py
```

Tests without a `// TC-xxx` comment are reported as untraceable and skipped. Report those to the user.

## Who edits what (remind the user when relevant)

Only `Status Chrome/Firefox/Safari` are edited by hand in Notion (manual test results). `TC ID`,
`Status Automation`, `Automatable`, and the page content come from the scripts and
`testcases.json`; manual edits to them are lost or break result sync. To change a test case's
content, use re-check mode and `--update`. Details: the "Who edits what" table in the guide.

## Report back

State plainly what ran and the script's final counts (created / updated / skipped / failed). If
anything failed, quote the error line and use the guide's Troubleshooting table; don't retry blindly
on `401/403/404` — those are credential or sharing problems the user must fix.
