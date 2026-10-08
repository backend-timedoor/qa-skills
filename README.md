# qa-skills

Claude Code plugins for QA: turn a dev site, repo, Figma design or PRD into test cases, upload them to Notion, and generate Playwright automation.

## Install (3 commands, inside Claude Code)

```
/plugin marketplace add backend-timedoor/qa-skills
/plugin install qa-ai-flow@qa-skills
/setup-qa-ai-flow
```

## What is inside

| Plugin | Skills | Purpose |
|---|---|---|
| `qa-ai-flow` | `setup-qa-ai-flow` | One-time project setup (config, env, e2e scaffold) |
| | `testcase-generator` | Dev site, repo, Figma screenshot and/or PRD (any mix) to `testcases.json` |
| | `notion-testcase-uploader` | Upload test cases to Notion, update after re-check, sync Playwright results back |
| | `playwright-from-testcases` | `testcases.json` to POM + Playwright specs |
| `pre-launch-check` | `setup-pre-launch-check` | One-time setup (config, env, Playwright runner) |
| | `pre-launch-check` | Run the before-launch checklist on a dev/staging site |
| | `review-checklist` | Claude's judgment pass over a run |
| `post-launch-check` | `setup-post-launch-check` | One-time setup (config, env, Playwright runner) |
| | `post-launch-check` | Run the after-launch checklist on the live site |
| | `review-checklist` | Claude's judgment pass over a run |

The Notion scripts are in `plugins/qa-ai-flow/scripts/`.

## Launch checklists

Install either plugin the same way (`/plugin install pre-launch-check@qa-skills` or `post-launch-check@qa-skills`), then run its setup skill once. Edit shared logic only in `shared/launch-checks/`, then run `shared/launch-checks/sync.sh`. Check for drift by hand with `shared/launch-checks/sync.sh --check`.

## Prerequisites

Node 18+, Python 3.9+ with `requests`, a Notion integration token (for upload), and optionally the Figma remote MCP server (only if you work from Figma).

## Docs

Guide page: `https://backend-timedoor.github.io/qa-skills/` (GitHub Pages, served from `/docs`).

## Updating

```
/plugin marketplace update qa-skills
```

License: MIT
