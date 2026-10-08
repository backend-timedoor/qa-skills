---
name: setup-pre-launch-check
description: One-time (re-runnable) setup of the pre-launch-check plugin in a project. Checks Node and Python, creates launch-check.config.json, .env entries, installs Playwright into launch-check/. Use for /setup-pre-launch-check, "set up the pre-launch checklist", or before the first run of pre-launch-check.
---

# Setup pre-launch-check

Prepare the current project to run the before-launch checklist. Safe to re-run: **never overwrite a file that already exists**, report it as "kept". Templates are in `${CLAUDE_PLUGIN_ROOT}/templates/`.

## Steps

1. **Check tooling** and report OK / missing with an install hint (never install system tools silently):
   `node --version` (18+), `npm --version`, `python3 --version` (3.9+). Python and `requests` are only needed for the optional Notion sync: `python3 -c "import requests"`, and offer `pip install -r ${CLAUDE_PLUGIN_ROOT}/requirements.txt` if missing.
2. **Config.** If `launch-check.config.json` is absent, ask for: the dev/staging `baseUrl`, optional extra URLs (contact page, login), optional Figma URL, and site language (`en` enables the date-format check). Copy `templates/launch-check.config.example.json` and fill in the answers.
3. **Env.** If `.env` is absent copy `templates/notion.env.example` to `.env`; if present, append any missing keys. Tell the user to fill in the dev site's basic auth, an optional PageSpeed API key, and (only for Notion sync) `NOTION_TOKEN` and `NOTION_CHECKLIST_DB_ID` themselves. Never ask them to paste secrets into chat.
4. **Runner.** Create `launch-check/` and copy `templates/package.json` into it if absent. Then `cd launch-check && npm install && npx playwright install chromium`.
5. **.gitignore.** Ensure `.env` and `launch-check/node_modules/` are listed. Reports under `launch-check/pre/` are meant to be committed unless the team prefers otherwise (ask once).
6. **Report** a short table: item, status (created / kept / missing) and the next step: "Run the pre-launch-check skill."
