---
name: playwright-from-testcases
description: >
  Bridges finished QA test cases into Playwright automation — the missing link
  between "test cases exist" and "automated tests exist." Use this skill whenever
  the user wants to turn a test case file (docs/test-cases/*.md from figma-testcase-generator,
  or the canonical testcases.json at the repo root)
  into runnable Playwright automation. Trigger on phrases like "automate these test cases",
  "generate Playwright from this TC file", "turn docs/test-cases/[page].md into tests",
  "implement automation for [module]", "build the E2E scripts for this", or any
  request to move from Fase 4 (Kasus Uji) to Fase 5 (Skrip Uji E2E) in an
  AIDD/SHIFT-style workflow. Always use this skill BEFORE writing any Playwright
  code from a test case file directly — it produces the structured "Instruksi
  Implementasi" that the repo root CLAUDE.md's Step 1–5 process expects, so
  skipping it means guessing at routes/selectors instead of deriving them properly.
---

# Playwright From Test Cases

Converts a finished test case list into (1) a structured Instruksi Implementasi
document and (2) actual Playwright Page Object Model + spec files, following the
conventions already defined in the project's `CLAUDE.md`.

This skill is the bridge between:
- **Fase 4 (input)** — test cases produced by `figma-testcase-generator`, living in
  `docs/test-cases/*.md` or `testcases.json` (repo root)
- **Fase 5 (output)** — Playwright POM + spec files, following `CLAUDE.md`'s
  Step 1–5 generation process

Do not skip straight to writing Playwright code from a test case file. Run the
steps below first — they're what make the automation traceable back to a specific
TC ID and consistent across modules.

---

## Step 0 — Resolve paths, load progress, locate and load the input

**Resolve project paths:** load `qa-ai-flow.config.json` if present at the
repo root (see `CLAUDE.md`'s Step 0 for the resolution/heuristic logic); fall
back to asking the user for `frontendRoot`/`backendRoot` if it's absent.

**Resolve discovery mode** (extends the above, doesn't replace it — decided
once here, reused for the rest of the session):
1. If `frontendRoot` resolves to a real, readable directory, Frontend
   discovery source = Repo (unchanged, see `CLAUDE.md`'s Step 1/Step 3).
2. If it doesn't (missing, wrong path, or no repo access), ask the user for
   `stagingUrl`. If given, persist it to `qa-ai-flow.config.json`. Frontend
   discovery source = Staging — see "Frontend Discovery (staging mode)"
   below.
3. If neither `frontendRoot` nor `stagingUrl` is available — the page is
   designed but not built yet — ask the user for a Figma file/frame/
   selection link (same "give me the link" pattern
   `figma-testcase-generator` uses). If given, persist it as `figmaLink` to
   `qa-ai-flow.config.json`. Frontend discovery source = Figma — see
   "Frontend Discovery (Figma mode)" below. If no link either, ask the user
   directly which source to use rather than guessing.
4. Independently: if `backendRoot` resolves, Backend discovery source =
   Repo (unchanged, see `CLAUDE.md`'s Step 2). If it doesn't, ask whether
   API docs exist (OpenAPI/Swagger, Postman collection, or none) and
   persist `apiDocs` the same way. If the answer is "none" (live-probe),
   also ask for `apiBaseUrl` — the base URL to hit when probing (e.g.
   `https://staging.example.com/api`, or a separate API host) — and
   persist it to `qa-ai-flow.config.json` the same way `stagingUrl` is
   persisted. Backend discovery source = API docs (if `apiDocs.type` isn't
   `"none"`) or Live probe (if it is) — see "Backend Discovery (staging
   mode)" below.
5. Frontend and backend are resolved independently — a project can use,
   say, Figma discovery for frontend and a repo read for backend.

**Load progress:** if `e2e/automation-instructions/_progress.md`
exists, read it and note any modules still "Pending" — mention them to the
user as candidates for this session. If it doesn't exist, it'll be
initialized in Step 6.

**Load the input**, in this order:
1. A file path the user gave directly
2. `testcases.json` at the repo root (preferred — structured, has `module` and can carry an `automatable` field)
3. `docs/test-cases/*.md` files matching the page/module name mentioned

If neither exists, ask the user which test case file/module to work from — do not invent test cases.

---

## Step 1 — Filter to automatable test cases

For each test case, determine if it's automatable:
- If the TC already has an `Automatable` / `automatable` field, use it.
- If missing, infer conservatively: mark **No** for anything requiring visual
  judgment, third-party email/SMS verification without a test hook, CAPTCHA, or
  subjective UI fidelity checks. Mark **Yes** for deterministic UI flows
  (form submit, CRUD, navigation, validation messages, permission checks).
- Always show the user the Yes/No split before proceeding: "X of Y test cases are
  automatable. Proceeding with the X."
- Never silently drop the "No" ones — list them at the end of the Instruksi doc
  under "Manual-only (not automated)" so nothing falls through the cracks.

---

## Step 2 — Group by module

Group the automatable test cases by their `module` field (e.g. "Auth & Login",
"Content Manager"). Each module becomes one Instruksi Implementasi block and,
downstream, maps to one feature area in `e2e/`.

---

## Step 3 — Generate the Instruksi Implementasi

For each module, produce this structure. This is the artifact a human (or Claude
Code following `CLAUDE.md`) uses to actually write the automation — treat it
like a spec, not a summary.

```
## Instruksi Implementasi — [Module Name]

**Source test cases:** TC-001, TC-003, TC-005 (N of M total in module)
**Discovery source:** Frontend: [Repo | Staging | Figma (predicted, unverified)] · Backend: [Repo | API docs | Live probe] — decided in Step 0's "Resolve discovery mode"
**Target files:**
- POM: e2e/pages/[Feature]Page.ts
- Spec: e2e/tests/[feature-name].spec.ts — omitted when Frontend discovery
  source is Figma; see "Frontend Discovery (Figma mode)" below

**Missing Automation IDs:** [list testable elements — per references/frontend-naming-guideline.md's Section 3 categories — found
without a data-testid, e.g. "checkout_page_place_order_button — no
data-testid found in rendered HTML/source, falling back to getByRole"; in
Figma mode this also covers layer names that don't match the naming
convention or whose page-prefix disagrees with their parent frame; use
"None" if none found]

**Routes to verify:**
- Frontend discovery source = Repo: read `{frontendRoot}/src/app/[guessed-route]/page.tsx` before writing (CLAUDE.md's "read before writing" rule).
- Frontend discovery source = Staging: browse `{stagingUrl}/[guessed-route]` live before writing — see playwright-from-testcases/SKILL.md's "Frontend Discovery (staging mode)" section.
- Frontend discovery source = Figma: no real route exists yet — see
  playwright-from-testcases/SKILL.md's "Frontend Discovery (Figma mode)"
  section.

**Endpoints to verify:**
- Backend discovery source = Repo: read `{backendRoot}/src/api/[guessed-content-type]/routes/`.
- Backend discovery source = API docs or Live probe: see playwright-from-testcases/SKILL.md's "Backend Discovery (staging mode)" section.

**Per test case:**

### TC-001 — [Title]
- **Test name pattern:** `[role] can [action] [subject]`
- **Preconditions / seed data:** [from prerequisites — translate into a
  beforeAll/API helper call if data setup is implied]
- **Steps → Playwright actions:**
  1. [step] → `page.goto(...)` / `page.getByRole(...).click()` etc.
  2. ...
- **Assertion:** [expected_result, translated into an `expect()` call]
- **Test data:** [from test_data field, or note "needs .env.test variable"]

[repeat per TC]

**Manual-only (not automated):**
- TC-04 — [Title] — reason: [why]
```

Do not invent selectors. Where the exact selector is unknown, write
`/* TODO: confirm selector — read [component file] (repo mode) / browse
{stagingUrl}/[route] (staging mode) */` rather than guessing — this keeps
the output honest and matches `CLAUDE.md`'s "read before writing" rule (or
its staging-mode counterpart, "browse before writing").

---

## Step 4 — Save the Instruksi document

Save to `e2e/automation-instructions/[module-kebab-case].md`. If
the file exists (resuming/adding TCs), append new TC blocks rather than
overwriting, same resumability convention as `figma-testcase-generator`.

---

## Step 5 — Hand off into the existing automation flow

Once the Instruksi doc is saved, follow `CLAUDE.md`'s generation process
exactly — this skill does not replace it, it feeds it:

1. **Auth check** — if any TC in this module needs a logged-in state, use whichever
   auth template (NextAuth / Strapi JWT / OAuth) is already detected in
   `CLAUDE.md`. If the method isn't detected yet, run `CLAUDE.md`'s
   Auth Method Detection checklist first.
2. **Map frontend routes, backend endpoints, and selectors for real**
   (replacing the TODOs from Step 3 above) — branch on the Instruksi doc's
   **Discovery source** field:
   - Frontend = Repo: follow `CLAUDE.md`'s Step 1 and Step 3 as today.
   - Frontend = Staging: follow "Frontend Discovery (staging mode)" below.
   - Frontend = Figma: follow "Frontend Discovery (Figma mode)" below.
   - Backend = Repo: follow `CLAUDE.md`'s Step 2 as today.
   - Backend = API docs / Live probe: follow "Backend Discovery (staging
     mode)" below.
3. **Step 4** — write/extend the POM at the target file path from the Instruksi
   doc, following the existing POM template.
4. **Step 5** — write/extend the spec file, one `test()` per TC, using the
   TC's own title as the base for the test name (per `CLAUDE.md`'s
   `[role] can [action] [subject]` pattern) and adding a comment linking back
   to the TC's `tc_id`, e.g. `// TC-001`. **Skip this item entirely when
   Frontend discovery source is Figma** — there's no live page to run
   against yet, so no spec file is written this run (see "Frontend
   Discovery (Figma mode)" below); stop after the POM.

The `// TC-001` comment is **mandatory** on every `test()`, sourced directly
from the TC's `tc_id` field (not invented, not derived from title). This is
the same machine key written to Notion's `TC ID` column — it's what lets
`update_test_results.py` map a Playwright result back to the right Notion
page. Every generated `test()` must be traceable to a TC ID via this comment —
it's what keeps Fase 4 and Fase 5 in sync when test cases get updated later.

Together, the following sections make up this skill's staging and Figma
discovery modes: resolving which source to use (Step 0's "Resolve
discovery mode" above), Frontend Discovery (staging and Figma variants),
Backend Discovery, and error handling.

### Frontend Discovery (staging mode)

⚠️ **Unverified** — confirm against a real staging site before treating
this section as stable.

Used when the Instruksi doc's Discovery source for Frontend is "Staging".

1. **Navigate** to `stagingUrl` (from `qa-ai-flow.config.json`) using the
   browser automation tools available in this environment.
2. **Point Playwright at the same site**: set `BASE_URL` in `e2e/.env.test`
   to the same value as `stagingUrl`, if it isn't already. The generated
   POM's `page.goto('/route')` calls resolve relative to Playwright's
   `baseURL` config (`e2e/playwright.config.ts`'s `BASE_URL` env var), so
   without this the tests would run against `localhost:3000` instead of
   the staging site discovery just ran against.
4. **Route discovery**: crawl same-origin links reachable from nav/footer/
   sitemap.xml starting at the homepage. This will miss auth-gated or
   deep-linked pages — for those, ask the user for the direct staging URL
   of the specific page/flow being automated, the same "give me the link"
   pattern already used for Figma frames in `figma-testcase-generator`.
5. **Selector discovery**: for the page currently being automated, inspect
   the live rendered DOM/accessibility tree. Same preference order
   `CLAUDE.md`'s Step 3 already defines — `data-testid` > `aria-label` >
   `getByRole` > `getByText` — just sourced from rendered HTML instead of
   JSX source. `data-testid` attributes render into final HTML, so nothing
   is lost compared to reading source.
   Staging mode can't read component source to infer an element's intent
   from surrounding code/props — the `data-testid` string itself is often
   the only intent signal available, so when reading it, check it against
   `${CLAUDE_PLUGIN_ROOT}/references/frontend-naming-guideline.md`'s
   `<page>_<element>_<component>` convention (see `CLAUDE.md`'s Step 3) and
   prefer that value verbatim over a hand-rolled locator. If a testable
   element (per the guideline's Section 3 categories) has no `data-testid`
   in the rendered HTML at all, don't fall back silently to text/xpath —
   record it under the Instruksi doc's **Missing Automation IDs** field
   (see Step 3 above), same as repo mode.
6. Record discovered routes/selectors directly into the POM (CLAUDE.md's
   Step 4) and spec (CLAUDE.md's Step 5) — same output shape as the
   repo-read path, only the discovery mechanism differs.

### Frontend Discovery (Figma mode)

⚠️ **Unverified** — same caveat as "Frontend Discovery (staging mode)"
above; confirm against a real Figma file before treating as stable.

Used when the Instruksi doc's Discovery source for Frontend is "Figma
(predicted, unverified)" — the page exists in design but hasn't shipped
yet, so there's no repo and no staging site to read from. This mode
produces *predicted* selectors from the design's own layer names, not
verified ones — see Step 5 item 4 above, which skips spec generation
entirely in this mode.

1. **Fetch the layer tree**: call `get_metadata` on the `figmaLink` from
   `qa-ai-flow.config.json` — the same tool `figma-testcase-generator`'s
   "Figma MCP Structure Discovery" step already uses and has verified
   (returns id/name/type/position/size for the node and its descendants).
   Do not reach for `get_design_context` in this flow, same as that skill's
   own finding.
2. **Establish the page prefix**: the top-level frame's name is the
   `<page>` prefix for everything under it (e.g. a `home_page` frame means
   descendants should be named `home_page_...`).
3. **Walk the tree** and classify each descendant by name:
   - **Matches the convention** (`<page>_<element>_<component>` or the
     dynamic `..._<identifier>` form, per `CLAUDE.md`'s Step 3) **and**
     its own page-prefix agrees with the frame's: treat it as a predicted
     `data-testid`. Add it to the POM as
     `page.getByTestId('exact_layer_name')`, tagged
     `// ⚠️ predicted from Figma layer name, not yet verified`.
   - **Matches the convention but the page-prefix disagrees with the
     frame** (e.g. a `news_page_...` layer nested inside a `home_page`
     frame): don't silently rename it to fit — record the mismatch in the
     Instruksi doc's **Missing Automation IDs** field so it gets reported
     back (per the guideline's Section 8 change-management process),
     same as a genuinely missing ID.
   - **Doesn't match the convention at all** (e.g. `swap_one`): same
     treatment — record it as a naming gap in **Missing Automation IDs**
     rather than guessing at what it should be called.
   - **Decorative** (backgrounds, generic shapes with no semantic suffix,
     not in the guideline's Section 3 categories): skip — no ID needed.
4. **Dynamic/repeated elements** (e.g. a card in a list): Figma has no
   runtime business ID to predict, so only the base pattern is known
   (`product_list_page_product_card`, not `..._12345`). Note this as a
   partial-match TODO in the POM rather than inventing a fake identifier —
   e.g. `/* TODO: this is a repeated element — confirm the real
   data-testid pattern (base name + stable ID) once the page ships */`.
5. **Routes**: there is no real route yet. Note an expected route derived
   from the frame/page name as a `/* TODO: confirm route once page ships
   */` comment in the POM's `goto()` call — don't treat it as verified.
6. **Stop after the POM** — per Step 5 item 4 above, do not write a spec
   file in this mode. The Instruksi doc's Discovery source stays "Figma
   (predicted, unverified)" until a later session re-runs Step 5 with
   Frontend = Repo or Staging to confirm the predictions and generate the
   spec.

### Backend Discovery (staging mode)

⚠️ **Unverified** — same caveat as "Frontend Discovery (staging mode)"
above; confirm against a real project before treating as stable.

Used when the Instruksi doc's Discovery source for Backend is "API docs" or
"Live probe". Deliberately framework-agnostic (Strapi, Laravel, or anything
else) — unlike `CLAUDE.md`'s Strapi-specific auth/helper templates, which
this section does not change (see the design spec's Non-Goals).

1. **`apiDocs.type: "openapi"` or `"postman"`**: parse the doc directly —
   both are machine-readable JSON/YAML, so endpoint paths, required
   fields, and auth scheme come straight out of it. Use these to write the
   `beforeAll`/`afterAll` seed/teardown helper (CLAUDE.md's Core Rule #5)
   and the login flow, instead of reading
   `{backendRoot}/src/api/**/routes/*.ts`.
2. **`apiDocs.type: "none"`**: fall back to live-probing — hit likely
   list/detail endpoints for the content type under test against
   `apiBaseUrl` (from `qa-ai-flow.config.json`, gathered in Step 0's
   "Resolve discovery mode"), infer field shapes from actual JSON
   responses. Mark every seed/teardown helper generated this way with a
   comment: `// ⚠️ field shape inferred from a live response, not
   confirmed against a schema — verify before relying on this in CI`.
3. **Auth login flow**: credentials still come from `.env.test` (unchanged
   mechanism) — but which endpoint/payload shape to POST to comes from the
   docs/probing step above, not an assumed Strapi `/api/auth/local` path.
   Write the discovered login call directly into the module's seed helper
   rather than reusing `CLAUDE.md`'s Strapi-specific `strapi.helper.ts`
   template verbatim when the backend isn't Strapi.

### Discovery error handling

⚠️ **Unverified** — same caveat as "Frontend Discovery (staging mode)" and
"Backend Discovery (staging mode)" above; confirm against a real project
before treating as stable.

Applies to Frontend (staging and Figma), and Backend, discovery above.
Fail loud, don't silently guess — same principle as this repo's Figma MCP
failure handling (`figma-testcase-generator/SKILL.md`'s "Figma MCP
Structure Discovery" section).

- **Staging URL unreachable** (down, wrong URL, network error): stop,
  report the failure to the user, do not proceed with guessed
  selectors/routes.
- **Route crawl finds nothing past the homepage** (e.g. everything is
  auth-gated): ask the user for direct URLs to the specific pages/flows
  being automated, rather than attempting to brute-force a login flow.
- **Figma link unreachable or no MCP access** (no Dev/Full seat, file not
  shared with the connected account, `get_metadata` errors): stop, report
  the failure to the user — same access-gate caveats as `CLAUDE.md`'s
  "Figma remote MCP server" prerequisite note. Do not fall back to
  guessing layer names from a screenshot; this mode's whole value is
  reading the design's real layer names.
- **No API docs and live-probing is ambiguous or empty**: ask the user to
  manually describe the fields needed for seeding, rather than guessing
  field names. A wrong guess here silently produces broken `beforeAll`
  seeding (Core Rule #5) — worse than stopping to ask.

---

## Step 6 — Report back

After writing files:

1. **Sanity-check the spec loads** (required, not optional, unless no spec
   was written this run — see below) — run `npx playwright test --list`
   (or `npm run test:list` if `e2e/package.json` exists) from `e2e/` to
   confirm the newly written spec file loads without syntax/import errors
   before reporting the module as done. If dependencies aren't installed
   yet, tell the user to run `npm install` in `e2e/` first — don't
   silently skip this check. **Skip this item for modules generated in
   Figma mode** — Step 5 item 4 didn't write a spec file for them, so
   there's nothing to list.
2. **Update the progress manifest** —
   `e2e/automation-instructions/_progress.md`. If it doesn't
   exist, create it with a header row and one row per module found in the
   input file:
   ```
   | Module | TC Count | Automated | Last Run | Status |
   |---|---|---|---|---|
   ```
   For this session's module(s), set: Automated = number of TCs converted to
   `test()` this run, Last Run = today's date, Status = ✅ Done if every
   automatable TC in the module is now covered, 🔶 Partial if some are, or
   🔮 Predicted if this module was generated in Figma mode (POM only, no
   spec yet — not the same as Partial, which means some real tests exist).
3. **Summarize to the user:**
   - Which modules were processed, how many TCs became tests
   - Which TCs were skipped as manual-only and why
   - Any TODO selectors left for the user to confirm
   - File paths written (POM + spec), so the user can review with
     `npx playwright test --ui` before committing
   - **Figma-predicted modules** — count and list of modules generated
     with Frontend discovery source = Figma this run, with a reminder to
     re-run once the page ships (repo or staging access) to verify the
     predicted selectors and generate the spec file.
   - **Missing Automation IDs** — if any processed module's Instruksi doc
     has non-"None" entries in its Missing Automation IDs field, surface a
     count and the list here, e.g. "3 elements missing data-testid — see
     e2e/automation-instructions/[module].md's Missing Automation IDs
     section; report to the frontend dev per the naming guideline's
     Section 8." Do not omit this from the summary even when the module is
     otherwise marked ✅ Done in the progress manifest.

---

## Idempotency rules

- If a spec file already exists for the module, **append** new `test()` blocks
  rather than regenerating the whole file — don't clobber tests a human may have
  hand-edited.
- If a TC ID's comment (`// TC-001`) already exists in the spec file, skip it —
  it's already automated. Report this to the user instead of duplicating.
- If the test case's `expected_result` or `steps_to_reproduce` changed since the
  test was last generated (compare against the Instruksi doc's saved copy),
  flag it: `⚠️ TC-001 changed since last automation — review e2e/tests/[file] manually.`
- If a module's Instruksi doc has Discovery source = Figma (predicted,
  unverified) and a later session finds `frontendRoot` or `stagingUrl` now
  available, re-run Step 5 for that module with the real discovery mode
  instead of treating it as already done — replace the predicted locators
  in the POM with verified ones (don't just append) and proceed to the
  spec file that was skipped the first time.

---

## What this skill does NOT do

- Does not decide automatability policy beyond the conservative inference in
  Step 1 — always defer to an explicit `Automatable` field if present.
- Does not run the tests. Suggest `npx playwright test --ui` as the next manual
  step; don't execute test runs unprompted.
- Does not replace `CLAUDE.md`'s POM/spec templates or naming conventions —
  it feeds them, not forks them.
- Does not invent or modify `data-testid` values in frontend source — only
  flags missing ones (per `references/frontend-naming-guideline.md`'s Section 3) in the Instruksi doc's Missing Automation IDs
  field and Step 6's summary. Adding or renaming the actual attribute in
  component code is the frontend developer's responsibility (see the
  guideline's Section 7 "Developer" rules and Section 8's change-management
  process) — not this skill's, and not Claude Code's, to do.
