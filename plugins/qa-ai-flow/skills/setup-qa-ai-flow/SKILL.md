---
name: setup-qa-ai-flow
description: One-time (re-runnable) setup of the qa-ai-flow plugin inside a project. Checks Node, Python and requests, copies the project CLAUDE.md, qa-ai-flow.config.json, .env files and the e2e/ Playwright scaffold from the plugin templates, and installs Playwright. Use for /setup-qa-ai-flow, "set up qa-ai-flow", "configure the QA flow for this project", or before the first run of testcase-generator or playwright-from-testcases in a repo.
---

# Setup qa-ai-flow

Prepare the current project so the other qa-ai-flow skills work. Safe to re-run:
**never overwrite a file that already exists** — report it as "kept" instead.
Templates live in `${CLAUDE_PLUGIN_ROOT}/templates/`.

## Steps

1. **Check tooling** and report each as OK / missing (with the install hint, don't install system tools silently):
   - `node --version` (18+), `npm --version`
   - `python3 --version` (3.9+) and `python3 -c "import requests"`; if missing, offer
     `pip install -r ${CLAUDE_PLUGIN_ROOT}/requirements.txt`
2. **Project CLAUDE.md** — if `CLAUDE.md` is absent at the project root, copy
   `templates/CLAUDE.md`. If one exists, don't overwrite; offer to append the qa-ai-flow section.
   The skills refer to this file's rules (POM, TC ID traceability, auth detection).
3. **Clarify the project first, before creating any file.** If `qa-ai-flow.config.json` already has
   `stack` and `layout`, show them and ask only "still correct?". Otherwise ask, in one go:
   - **Tech stack:** frontend (Next.js / Vue.js / WordPress / other / none) and backend or admin
     (Laravel / WordPress / other / none).
   - **Topology:** monorepo (frontend and backend are folders of one repo) / split repos (separate
     repos) / single app / no repo access. For monorepo or split, ask for the `frontendRoot` and
     `backendRoot` paths.
   - **Live environment:** `stagingUrl`, `apiBaseUrl`, and API docs type (OpenAPI / Postman / none).
     Needed whenever repo access is missing.
   Then copy `templates/qa-ai-flow.config.example.json` to `qa-ai-flow.config.json`, fill in the
   answers (`stack`, `layout`, roots, URLs), and fill the Project Overview table in the project's
   `CLAUDE.md` to match. No repo access is normal: leave the roots empty and use `stagingUrl`.
4. **Env files** — copy `templates/notion.env.example` to `.env` and `templates/e2e.env.test.example`
   to `e2e/.env.test` if absent. Tell the user to fill in the values themselves
   (see `${CLAUDE_PLUGIN_ROOT}/scripts/GET_NOTION_CREDENTIALS.md`); never ask them to paste secrets into chat.
5. **e2e scaffold** — copy `templates/e2e/package.json` and `playwright.config.ts` into `e2e/`
   (absent files only), create `e2e/pages`, `e2e/tests`, `e2e/helpers`, `e2e/fixtures`.
   Then `cd e2e && npm install && npx playwright install chromium`.
6. **.gitignore** — ensure these lines exist (secrets and build artifacts only): `.env`, `.env.test`,
   `qa-ai-flow.config.json`, `e2e/node_modules/`, `e2e/reports/`, `e2e/test-results/`, `e2e/playwright-report/`,
   `e2e/.auth/`.
   **Generated test cases are shared with the team, so do NOT ignore them.** `testcases.json`,
   `docs/test-cases/`, and everything under `e2e/` except the artifacts above (pages, tests, helpers,
   `automation-instructions/`) are meant to be committed. If the project's `.gitignore` already ignores
   `testcases*.json` or `docs/test-cases/`, tell the user and offer to remove those lines (ask first, it is
   their file). Remind them that `test_data` in test cases must never hold real credentials, because the
   files are committed.
7. **Verify** with `cd e2e && npx playwright test --list` (empty is fine; it must load without errors).
8. **Report** a short table: item, status (created / kept / missing), and the next step:
   "Run testcase-generator with a dev/staging URL, repo path or Figma screenshot, or playwright-from-testcases with testcases.json."

## Not in scope
Detecting the app's auth method and generating tests — those belong to `playwright-from-testcases`.
