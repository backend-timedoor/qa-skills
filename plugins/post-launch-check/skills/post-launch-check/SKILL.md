---
name: post-launch-check
description: Run the after-launch website checklist on the live site. Crawls the site, runs the automated SEO, indexing (index, follow expected), Google Analytics, HTTPS, link, performance and image checks, hands judgment rows to Claude, lists manual rows, and writes launch-check/post/<date>/report.md. Use for "post-launch check", "run the after launch checklist", "check the live site after launch", or /post-launch-check.
---

# Post-launch check

Runs the Timedoor **after launch** checklist against the live site. For dev/staging use `pre-launch-check`.

## Prerequisites
`launch-check.config.json` and `launch-check/node_modules` must exist. If not, run `setup-post-launch-check` first.

## Steps

1. **Run the engine** from the project root (replace `<date>` with today as YYYY-MM-DD):
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/vendor/launch-checks/cli.js run \
     --config launch-check.config.json \
     --phase ${CLAUDE_PLUGIN_ROOT}/phase.json \
     --out launch-check/post/<date>
   ```
2. **Exit code 2** means the site does not look live (basic auth, noindex or a robots.txt disallow was found, which usually means staging). Show the warning and ask whether to continue. Only re-run with `--yes` if they confirm; if they meant staging, point them to `pre-launch-check`.
3. **Exit code 1** means a setup or config error. Show the message and fix it with the user; do not retry blindly.
4. **Review pass.** Run the `review-checklist` skill on `launch-check/post/<date>`.
5. **Summarize** for the user from `report.md`: counts per status, every `fail` and `error` row with its pages, then what is left for them (`review-needed` and `manual-todo` rows). Remind them that Google Analytics numbers must be confirmed with the PM in the analytics console, and that the contact form message must be sent by hand (CAP-002).
6. **Optional Notion sync.** Only if the user asks (and `NOTION_TOKEN` and `NOTION_CHECKLIST_DB_ID` are set): first
   `python3 ${CLAUDE_PLUGIN_ROOT}/vendor/launch-checks/notion/sync_checklist_to_notion.py sync launch-check/post/<date> --dry-run`,
   show the result, and run it again without `--dry-run` once the user agrees. To bring testers' edits back: `... pull launch-check/post/<date>` and then
   `node ${CLAUDE_PLUGIN_ROOT}/vendor/launch-checks/cli.js render launch-check/post/<date>`.

## What is checked
Expectations for this phase: robots.txt allows crawling, meta robots `index, follow`, Google Analytics script present. Row types: `auto` (script), `review` (Claude), `manual` (human, Figma). The full list is in `${CLAUDE_PLUGIN_ROOT}/vendor/launch-checks/catalog/rows.json`.

## Not in scope
Comparing against Figma, contrast, responsive layout, and logging in beyond basic auth are manual rows.
