# qa-skills

Claude Code plugins for QA: turn Figma designs or Strapi schemas into test cases, upload them to Notion, and generate Playwright automation.

## Install (3 commands, inside Claude Code)

```
/plugin marketplace add <ORG>/qa-skills
/plugin install qa-ai-flow@qa-skills
/setup-qa-ai-flow
```

Replace `<ORG>` with the GitHub org/user that hosts this repo.

## What is inside

| Plugin | Skills | Purpose |
|---|---|---|
| `qa-ai-flow` | `setup-qa-ai-flow` | One-time project setup (config, env, e2e scaffold) |
| | `figma-testcase-generator` | Figma screenshot (+ PRD) to `testcases.json` |
| | `playwright-from-testcases` | `testcases.json` to POM + Playwright specs |

Scripts (Strapi test-case generator, Notion upload and result sync) are in `plugins/qa-ai-flow/scripts/`.

## Prerequisites

Node 18+, Python 3.9+ with `requests`, a Notion integration token (for upload), and optionally the Figma remote MCP server.

## Docs

Guide page: `https://<ORG>.github.io/qa-skills/` (GitHub Pages, served from `/docs`).

## Updating

```
/plugin marketplace update qa-skills
```

License: MIT
