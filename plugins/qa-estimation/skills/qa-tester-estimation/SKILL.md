---
name: qa-tester-estimation
description: Estimate QA tester man-hours (AI-powered, black-box) for an inquiry from its PRD, spec, notes and module quotation list, then fill the "Tester (hrs)" column of the Timedoor quotation workbook (*Quotation-Context.xlsx) and build a companion QA breakdown workbook. Use this whenever someone asks for QA/tester mandays or man hours, testing effort for an inquiry or quotation, or to fill the Tester column — and also to review, trim, de-duplicate, or add retest & regression to an existing tester estimate, even if they never say "skill" or "estimate" (e.g. "isi kolom tester", "mandays QA", "berapa jam testing untuk inquiry ini", "pangkas jam tester").
---

# QA Tester Estimation

Estimate the Tester hours for a Timedoor quotation using the approach the QA team agreed on:
- **AI-powered QA**: test cases are generated from the PRD (acceptance criteria, edge cases, state diagrams, DoD) and then reviewed by the tester, so writing test cases is cheap and execution dominates.
- **Black-box**: QA verifies what users and admins can see on the website and back-office, not the mechanisms behind it. Mechanisms (signatures, idempotency, retries, log sanitisation, load tests, backups) belong to developers or DevOps.

Only the Tester column is in scope. Design, FE, BE and Mobile hours are someone else's.

Talk to the user in their language (the team works in Bahasa Indonesia). Paths below use `${CLAUDE_PLUGIN_ROOT}`; dependencies: `python3` and `openpyxl` (`pip install -r ${CLAUDE_PLUGIN_ROOT}/requirements.txt` if `python3 -c "import openpyxl"` fails).

## Workflow

### 1. Read everything first
Read every `.md` in the inquiry folder (PRD, spec, notes, module quotation) and the `Quotation` sheet of `*Quotation-Context.xlsx`. Print the current task rows with:
```
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fill_tester.py <quotation.xlsx> --show
```
Look for:
- The module and task rows in the quotation — they define the priced scope.
- Acceptance criteria, edge cases, state diagrams, DoD and the role permission matrix in the PRD/spec — they decide how heavy each task is.
- **Scope differences** between PRD/spec and the quotation (a module in the PRD that the quotation lacks, or the reverse). Don't decide these yourself; ask.

### 2. Ask only what changes the numbers
One round of AskUserQuestion at most:
- Scope differences: follow the quotation, add them, or estimate them separately as optional?
- Anything beyond the default (E2E automation, penetration test, QA-run load test)?
- How many UAT sessions to assume (default 2)?

Don't ask about the defaults: AI-powered, black-box, hours as the unit, retest only for critical modules (step 5).

### 3. Estimate per task row
The quotation sums task rows, so estimate each row, not each module. Tester hours = writing/reviewing test cases + one execution cycle. Use `${CLAUDE_PLUGIN_ROOT}/references/estimation-guide.md` for hours per task type, the black-box exclusions and the de-duplication rules. The principles behind them:
- **Size by scenarios, not by FE hours.** A business-rule engine can be 2 FE hours and 11 tester hours; a landing page can be 12 FE hours and 4 tester hours. That is why tester hours are never derived mechanically from FE.
- **Test each behaviour once**, on the screen where its result is visible. Pure integration modules (payment gateway, shipping aggregator, third-party API) usually get 0 and are tested end-to-end in the web/admin module that shows the result. Double counting is the most common reason estimates come out too high.
- **Outside black-box → 0 Tester hours**, and say who owns it (developer, BE, DevOps), otherwise nobody does it.
- QA process work (test plan, UAT support, test report & sign-off) goes on the "QA - ..." row of the foundation/release module. Functional and integration testing stay on their own modules; add a note so the client doesn't think they are counted twice.

### 4. Write notes in the Notes column
Every row set to 0 because of de-duplication or black-box gets a pointer, so the client can see who tests it: `QA: dites di M05 Payment Status page`, `QA: tidak termasuk; load test dikerjakan BE/DevOps`. The receiving row gets the reverse note: `QA: termasuk pembayaran DOKU end-to-end (M14)`. If a Notes cell already has text (e.g. a Design note), append with ` | ` instead of overwriting.

### 5. Retest & regression for critical modules only
Add the hours straight into the Tester column of the related task rows and mark them in Notes (`Termasuk retest & regression X jam`):
- **Tier 1 — 50% of execution**: money, price, points/commission and order status — checkout, promo/discount engine, order & fulfillment, member pricing, point distribution.
- **Tier 2 — 25%**: customer auth, RBAC/internal users, product/price/stock master data.
- **Final E2E regression** before go-live: about 4 hours on the QA row.
- Other modules: bug retest without regression, not counted separately.

Don't put tester hours in **Buffer Mandays** on the Summary sheet: that buffer is priced at the Programmer rate (`RateCard!C`) and also extends the Timeline. Tell the user if they suggest it.

### 6. Write the quotation safely
Write a plan JSON and run `fill_tester.py` (format in its docstring), first with `--dry-run`, then for real:
```
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fill_tester.py <quotation.xlsx> plan.json --backup-dir <dir> --dry-run
```
Give each change an `expect` (the current hours) so the script aborts instead of silently overwriting a value the user edited by hand. The script exists because these went wrong before:
- **Lock file** `.~lock.<name>#` means the user has the workbook open in LibreOffice. Never kill soffice/LibreOffice processes — that window is theirs and unsaved work is lost. Saving is still fine; tell them to close the window **without saving** and reopen it, or their old copy overwrites yours.
- It **backs up** before writing.
- It writes **only Tester and Notes cells** via openpyxl. Never re-save the quotation through LibreOffice or a recalc script: the Timeline sheet uses `LET`, which LibreOffice rewrites to `let`/`#NAME?`, and styles change too.
- It verifies by summing the cells per section instead of recalculating. If you want to check formulas anyway, recalc a **copy**; `#NAME?` on Timeline in that copy comes from `LET`, not from your change.
- It sets `fullCalcOnLoad` so Excel recalculates on open.

### 7. Build the companion QA workbook
Build `qa-manhours-<project>.xlsx` with `scripts/build_qa_workbook.py` from a spec JSON (format in its docstring; a full example is `${CLAUDE_PLUGIN_ROOT}/references/example-spec.json`). It contains a **QA Man Hours** sheet (per module: test scope, test case, execution, retest & regression, total, notes; section subtotals; internal buffer; calendar duration; separate optional section) and an **Asumsi** sheet with editable parameters. The script prints its own totals, so no recalculation is needed.

Keep test case + execution + retest per module in this workbook **identical** to the module's Tester total in the quotation. Whenever the quotation changes, rebuild this file.

### 8. Report
Summarise in tables: hours per section (and per changed task), totals before/after, Tester vs FE (+BE when present), backup location, and what is still open (e.g. load test has no owner in the BE column yet, UAT session assumption). If an earlier message had a wrong number, correct it explicitly.

## When asked to review or trim
Tag each proposed change: **[T]** overlaps another module, **[B]** outside black-box, **[L]** estimate too loose. Show a Current → Proposed table, list what you deliberately kept and why, and ask for confirmation before writing to any file. For this approach a Tester share of roughly 25–40% of total dev (FE+BE) is normal; with BE still empty, comparing against FE alone overstates the ratio because much of what testers verify lives in the backend.
