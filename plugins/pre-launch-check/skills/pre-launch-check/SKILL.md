---
name: pre-launch-check
description: Run the before-launch website checklist on a dev or staging site. Crawls the site, runs the automated SEO, crawling (noindex expected), basic auth, HTTPS, link, performance and image checks, hands judgment rows to Claude, lists manual rows, and writes launch-check/pre/<date>/report.md. Use for "pre-launch check", "run the before launch checklist", "check the staging site before launch", or /pre-launch-check.
---

# Pre-launch check

Runs the Timedoor **before launch** checklist against a dev/staging site. For the live site use `post-launch-check`.

## Prerequisites
`launch-check.config.json` and `launch-check/node_modules` must exist. If not, run `setup-pre-launch-check` first.

## Steps

1. **Run the engine** from the project root (replace `<date>` with today as YYYY-MM-DD):
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/vendor/launch-checks/cli.js run \
     --config launch-check.config.json \
     --phase ${CLAUDE_PLUGIN_ROOT}/phase.json \
     --out launch-check/pre/<date>
   ```
2. **Exit code 2** means the site does not look like staging (it appears live). Show the warning to the user and ask whether to continue. Only re-run with `--yes` if they confirm; if they would rather check the live site, point them to `post-launch-check`.
3. **Exit code 1** means a setup or config error. Show the message and fix it with the user; do not retry blindly.
4. **Review pass.** Run the `review-checklist` skill on `launch-check/pre/<date>`.
5. **Summarize** for the user from `report.md`: counts per status, every `fail` and `error` row with its pages, then what is left for them (`review-needed` and `manual-todo` rows). Mention where the full report is.
6. **Optional Notion sync.** Only if the user asks (and `NOTION_TOKEN` and `NOTION_CHECKLIST_DB_ID` are set): first
   `python3 ${CLAUDE_PLUGIN_ROOT}/vendor/launch-checks/notion/sync_checklist_to_notion.py sync launch-check/pre/<date> --dry-run`,
   show the result, and run it again without `--dry-run` once the user agrees. To bring testers' edits back: `... pull launch-check/pre/<date>` and then
   `node ${CLAUDE_PLUGIN_ROOT}/vendor/launch-checks/cli.js render launch-check/pre/<date>`.

## What is checked
Expectations for this phase: robots.txt disallows all, meta robots `noindex, nofollow`, basic auth visible. Row types: `auto` (script), `review` (Claude), `manual` (human, Figma). The full list is in `${CLAUDE_PLUGIN_ROOT}/vendor/launch-checks/catalog/rows.json`.

## Not in scope
Comparing against Figma, contrast, responsive layout, and logging in beyond basic auth are manual rows.
