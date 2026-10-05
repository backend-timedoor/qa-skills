---
name: figma-testcase-generator
description: >
  Generate comprehensive QA test cases from Figma design screenshots. Use this skill
  whenever a user uploads a Figma design image, section screenshot, or UI mockup and wants
  to create test cases, QA cases, or test scenarios from it. Also trigger when the user
  mentions "test case from design", "QA from Figma", "generate test cases", or uploads
  any UI screenshot for testing purposes. Works best with per-section images — if the
  user uploads a very long full-page screenshot, guide them to split it into sections first.
  Also trigger — with no image required — when the user wants to re-check or update
  test cases that already exist because a module/component/page changed, e.g. "re-check
  test cases for [module]", "recheck", "TCs changed", "update test cases for [module]",
  "the [component] states changed".
---

# Figma Test Case Generator

Generate thorough, structured QA test cases from Figma design images.

---

## When the User Uploads an Image

### Step -2 — PRD ingestion (optional, ask once, before Step -1)

Ask once, before any other context questions: "Do you have a PRD (requirements
doc) for this feature? If so, paste the text or upload the `.md`/`.txt` file."
Primary input format is markdown/plain text — paste or upload directly, no
PDF/Doc parsing pipeline. If the user has another format, ask them to paste
the relevant text as a fallback.

If a PRD is provided:
- Extract acceptance criteria, business rules, roles/permissions, and any
  PM-called-out edge cases into a requirement checklist.
- Hold this checklist in working memory for the Reconciliation Protocol
  later — it becomes the `source_requirement` value for whichever TCs it
  produces.

#### Requirement IDs — reuse before you invent

`source_requirement` is written to `testcases.json` and pushed to Notion, so
it outlives the session that produced it. An ID invented on the fly is a
session artifact: re-run the same PRD next month and the numbering may land
differently, leaving one `testcases.json` holding two incompatible ID
schemes with nothing marking the seam. Prefer IDs the document already
carries — those only change when a human edits the PRD.

1. **Check for existing IDs first.** Scan the PRD for a repeated identifier
   pattern attached to requirements — e.g. `US-C-001`, `EC-A-003`, `FR-12`,
   `REQ-4`. If the document numbers its own requirements, **use those IDs
   verbatim and do not renumber them.**
2. **Invent only as a fallback.** If the PRD carries no IDs of its own,
   normalize to a `REQ-n` checklist as before (e.g. `REQ-1: Only Admin role
   can delete a published post`). This is the original behavior, unchanged.
3. **Sub-index multiple criteria.** One identified requirement often holds
   several acceptance criteria that each become their own TC. Sub-index them
   in document order so each TC traces to a specific criterion rather than
   the whole story: `US-C-007.1`, `US-C-007.2`, `US-C-007.3`. Skip the
   sub-index only when the requirement holds exactly one criterion.
4. **Un-numbered requirement text.** Summary tables, DoD checklists, and NFR
   tables usually restate a requirement that already has an ID — reuse that
   ID rather than coining a second one for the same rule. If an item is
   genuinely new (stated nowhere else in the document), mint a `REQ-n` for
   it and **tell the user which IDs you minted and why**, so invented IDs
   are never mixed in silently.

Mixed sources are fine and expected: one session can carry `US-C-007.2`,
`EC-A-003`, and a minted `REQ-1` side by side.

If no PRD is given (or the user skips/declines), proceed straight to Step -1
with no behavior change from today — this step is fully optional and adds
zero overhead when skipped.

---

### Step -1 — Gather context (ask once, before generating)

Before analyzing the image, ask the user these questions in a single message:

1. **App type** — "Is this a web app, mobile app, or desktop app?"
2. **Test tooling** — "Do you have a preferred test tool or framework? (e.g. Playwright, Cypress, Selenium, manual only)"
3. **Figma MCP link (optional)** — "Do you have a Figma MCP connection set
   up, and if so, can you share the file/frame/selection link for this
   design? Skip this if you don't have Figma MCP connected — I'll work from
   the screenshot alone."

Wait for their response before proceeding. Use the answers to:
- Tailor step descriptions (e.g. "Tap" vs "Click" for mobile, viewport sizes for responsive TCs)
- Populate the `Automatable` field with the correct tool name
- If user says "manual only" or skips — mark all as `Automatable: No`
- If a Figma link is given, run the "Figma MCP Structure Discovery" step
  below before Step 0. If no link is given, skip that step entirely and
  proceed exactly as today (screenshot-only).

Figma's remote MCP server is link-based — it cannot browse a file's tree on
its own, which is why this link must be collected here up front rather than
assumed later. Note MCP access requires a Figma Dev/Full seat, which may not
be available to whoever is running this skill — if there's no link or no
MCP connection, that's the expected common case, not an error; proceed
screenshot-only.

Skip this step if the user already provided this context in their message.

---

### Step -1.5 — Re-check or fresh generation?

Ask, in the same message as Step -1 if not already answered: "Is this a
fresh generation, or a re-check because something changed in an
already-generated module?"

- If the user says **fresh** (or doesn't mention re-checking at all): proceed
  exactly as documented below, no behavior change.
- If the user says **re-check**: this session's input can be a new
  screenshot, a text description of what changed, or both — there's no
  requirement to upload a new image for a re-check. Skip straight to
  "Re-check Mode" below instead of proceeding through the normal
  fresh-generation order — Re-check Mode tells you exactly when to run
  Step 0's image-length check (now, if a new screenshot was given) and
  when to loop back into Figma MCP Structure Discovery and the Analysis
  Protocol (deferred until the matched subset is narrowed — see
  "Revision, diff & per-TC approval" below).
- If the user mentions a requirement ID (`REQ-n`, or a PRD-native id like
  `US-C-007` — see Step -2) as the reason for the re-check: that's the
  PRD-driven lookup path, which is **not implemented yet** (blocked on `source_requirement` being exercised
  against a real PRD+Figma session — see
  the unverified-items list). Tell the user
  this path isn't built, and ask them to name the affected module/page and
  component/area instead, so the design-driven path below can be used.

---

### Figma MCP Structure Discovery (only if a Figma link was given in Step -1)

If no Figma link was provided in Step -1, skip this section entirely and go
straight to Step 0.

> ✅ **Verified 2026-08-05** against a live Figma remote MCP session (real
> OAuth login, real file). Confirmed tool names: `get_metadata` (returns an
> XML dump of a node/frame subtree — id, name, type, position, size only),
> `get_screenshot` (renders a node to PNG — always available, this is what
> the vision fallback actually calls), `get_design_context` (code-oriented;
> requires loading Figma's own `figma-design-to-code` skill guidance before
> calling it, and is untested here for QA purposes — don't reach for it in
> this flow), `whoami` (auth/access debugging only, not design data).
>
> **Useful side-finding:** `get_metadata`'s `name` attribute on a plain text
> node (one not wrapped in a shared text-style component) is that node's
> actual rendered string — e.g. a hero headline or card label comes through
> as real, readable copy, not a guessed label. This is genuinely useful for
> tiers 2/3 below and for Analysis Protocol item 0. It does **not** hold for
> text living inside a component *instance* (see tier 1 note next).

State signals can live at different levels depending on how disciplined a
given Figma file is about Variants, so check all three tiers independently
rather than assuming one:

1. **Component-level Variants — confirmed NOT exposed by `get_metadata`.**
   Tested against real component instances (e.g. tab/menu items): the XML
   returned only the instance's id/name/position — no Variant property
   values, and no overridden text content inside the instance. No tool in
   this MCP surface has been found that returns Variant property values.
   Treat tier 1 as **unavailable**, not merely "check if it comes back
   empty" — go straight to the vision-based approach (screenshot the
   component in its different states, if the design shows them) for every
   component, not just ones where a query happens to return nothing. If a
   future MCP update or a different tool exposes Variant data, revisit this.
2. **Sibling-component families** — for structurally different components
   not modeled as Variants (e.g. Card), look for multiple
   components/instances sharing a name prefix (`Card/Product`,
   `Card/Product-OutOfStock`, `Card/Product-Empty`) and treat each sibling
   as a distinct state, using the name suffix as the state label.
3. **Screen-level edge cases** — enumerate top-level frame/page names in
   the file/link scope and flag ones matching common edge-case patterns
   (error, empty, 404, not-found, no-results) as states to generate TCs for.

For tiers 2/3, fall back to the vision-based approach (via `get_screenshot`)
for any specific component/screen the metadata pass doesn't clearly resolve
— this is a per-signal fallback, not a whole-file one, so a single run can
use MCP data for one component and vision for everything else.

Emit a `> ⚠️ Design Note` only when a component visually looks like it has
multiple states (hover/disabled/error, etc., judged from the screenshot,
since MCP can't confirm Variant usage either way — see tier 1 above) but
the file gives no other signal of that state being modeled anywhere —
that's the actual coaching-worthy gap. Components covered by tiers 2/3
(sibling components, separate top-level frames) are a normal, valid
pattern for many teams, not a gap to flag.

If the MCP call fails or returns no data for the given link (e.g. the
connected account lacks a Dev/Full seat, or lacks view access to the file),
fall back to the vision-only flow and tell the user why, rather than
silently degrading.

---

### Step 0 — Check image length
If the uploaded image appears to be a **full-page scroll** (very tall, multiple distinct sections stacked):
- **Pause** and advise the user to split it into sections before proceeding.
- Suggest splitting by logical UI sections: hero, form, table, modal, navigation, footer, etc.
- Offer to proceed anyway with a warning that coverage may be less comprehensive.

If the image is a **focused section** (a single component, form, screen state, or UI block): proceed directly.

---

## Analysis Protocol (do this mentally before writing test cases)

For every image, scan for the following and note what you find:

### 0. Structural Signals (only if Figma MCP data was gathered above)
Prefer MCP-sourced layer/frame/component/variant names and text-node
content over visually-guessed labels when both are available — this spans
all three structure-discovery tiers above (Variant properties,
sibling-component family names, top-level frame/page names), not just
Variants. Use sizing mode (hug vs fixed) as a signal for growth/overflow
edge cases (long lists, long text).

### 1. UI Elements Inventory
List every interactive and static element visible:
- Inputs (text, dropdown, checkbox, radio, date picker, file upload, etc.)
- Buttons (primary, secondary, icon-only, disabled states)
- Navigation (tabs, breadcrumbs, sidebar, pagination)
- Display elements (tables, cards, lists, modals, tooltips, banners)
- Images, icons, labels, placeholders

### 2. States Visible
Identify any states shown in the design:
- Default / empty / loading / error / success / disabled
- Hover or focus states if mocked
- Filled vs. unfilled form fields

### 3. Interactions Implied
Even if not explicitly shown, infer what interactions would exist:
- Form submission → what validates? what errors could appear?
- Button clicks → what should happen?
- Conditional visibility → does anything show/hide based on input?
- Sorting, filtering, searching

### 4. Edge Cases to Cover
For every input/action, consider:
- Empty / blank submission
- Boundary values (max length, min/max numbers, special characters)
- Invalid formats (wrong email, future-only date fields, etc.)
- Duplicate data
- Long text overflow
- Mobile/responsive behavior if layout suggests it

### 5. Accessibility Signals
- Is there sufficient label/placeholder text?
- Are there icon-only buttons (need aria labels)?
- Color contrast indicators
- Tab order / keyboard navigation

---

## Reconciliation Protocol (only if a PRD was provided in Step -2)

Runs after the Analysis Protocol, before writing output. Skip entirely if no
PRD was ingested — no behavior change from today.

1. **PRD → TC coverage check** — every requirement ID from Step -2 must have
   at least one TC; if a requirement has no visual counterpart (e.g. "3
   failed payments locks the account"), still generate the TC and flag it
   `> ⚠️ PRD-only: no corresponding UI state in design`.
2. **UI → PRD gap check** — a UI state matching no requirement ID still
   becomes a TC as normal, flagged
   `> ⚠️ Design-only: not mentioned in PRD — confirm intended`.
3. **Conflict check** — distinct from 1/2 above, which are one-sided gaps
   (a fact mentioned in only one source, not a contradiction) and stay
   non-blocking. A **conflict** is when the PRD and design state the *same*
   fact differently (e.g. PRD says "max upload 5MB," design's error text
   says "10MB") — only one can be true in the running app, so generating
   TCs for both just defers a guaranteed Playwright failure to Step 3
   instead of resolving it now. Stop and ask the user which value is
   authoritative before generating a TC for that requirement — this session
   is already interactive, so resolving it here is cheap, and conflicts are
   expected to be rare compared to items 1/2.
4. End-of-session **Traceability Summary** shown in chat (requirement ID →
   `TC-id`s, e.g. `US-C-007.2 → TC-014`), not written to file. Use whichever
   ID scheme Step -2 settled on; if any IDs were minted rather than taken
   from the PRD, mark them as such here.

---

## Re-check Mode (only if Step -1.5 selected re-check)

Everything below assumes Step -1.5 confirmed this is a re-check and the
module is design-driven (no requirement ID). If the user gave a new screenshot,
run Step 0's image-length check on it now; Figma MCP Structure Discovery
and the Analysis Protocol are deliberately deferred until "Revision, diff
& per-TC approval" below, after the matched subset is narrowed.

### Matching — Module

> Before doing any of the matching below, note the missing-`tc_id`
> precheck in "Error handling" below — matching and write-back both
> assume every entry in scope carries a `tc_id`. As soon as this
> subsection resolves to exactly one confirmed module, run that precheck
> scoped to it (`module=<confirmed module>`) before moving on to
> "Matching — Keyword narrow" — that's what keeps the keyword-narrow step
> below from choking on entries with no `tc_id`.

Never guess which module the user means. Run this against `testcases.json`
(the canonical path — see "Saving Output to File" below) to find candidate
modules, substituting `query` with the user's wording, lowercased:

```python
import json, difflib

def match_module(query, path="testcases.json"):
    with open(path) as f:
        data = json.load(f)
    modules = sorted(set(e["module"] for e in data))
    q = query.lower()
    substr = [m for m in modules if q in m.lower() or m.lower() in q]
    if substr:
        return substr
    lower_map = {m.lower(): m for m in modules}
    close = difflib.get_close_matches(q, list(lower_map.keys()), n=3, cutoff=0.4)
    return [lower_map[c] for c in close]

print(match_module("<user's wording here>"))
```

Run it via Bash (`python3 -c "..."`), not by reading `testcases.json` into
your own context — the file can hold hundreds of TCs across all modules.

- **Exactly one match:** confirm with the user before proceeding —
  `"Matched module: '<module>' (<N> TCs). Proceed?"`
- **Zero matches:** list all module names (`sorted(set(e["module"] for e in
  data))`) and ask the user to pick one, or confirm this is actually a new
  module (i.e. not a re-check — fresh generation instead).
- **Multiple matches:** list the candidates and ask the user to
  disambiguate. Do not pick one for them.

### Matching — Keyword narrow

Once a module is confirmed, narrow to the TCs the user's described change
actually touches — never treat "module changed" as "re-analyze the entire
module" by default:

```python
import json

def narrow_by_keyword(keyword, module, path="testcases.json"):
    with open(path) as f:
        data = json.load(f)
    subset = [e for e in data if e["module"] == module]
    kw = keyword.lower()
    matched = []
    for e in subset:
        haystack = " ".join([
            e.get("title", ""),
            " ".join(e.get("steps_to_reproduce", [])),
            e.get("note", ""),
        ]).lower()
        if kw in haystack:
            matched.append(e.get("tc_id"))
    return matched, len(subset)

matched, total = narrow_by_keyword("<component/area name>", "<confirmed module>")
print(f"{len(matched)} of {total} TCs matched: {matched}")
```

- **Some matched:** confirm — `"<N> TCs matched by keyword '<keyword>'.
  Proceed with these, or re-check the whole module instead?"` Offer the
  whole-module fallback explicitly; the user may accept it if the keyword
  search under-matched.
- **Zero matched:** tell the user, then offer the whole-module fallback
  the same way.

The IDs returned here (`matched`, or every `tc_id` in the module if the
user chose the whole-module fallback) are "the matched subset" that the
next step (Revision, diff & per-TC approval) operates on.

Those IDs alone aren't enough for that next step — it needs full field
values to diff, and the design intent is that only the matched subset,
never the whole file, gets loaded into context. Bridge the two with:

```python
def load_by_ids(ids, path="testcases.json"):
    with open(path) as f:
        data = json.load(f)
    return [e for e in data if e.get("tc_id") in set(ids)]
```

Run this with the matched subset's IDs (`matched` above, or every `tc_id`
in the module for the whole-module fallback). Only the entries it returns
— never the whole file — are what gets loaded into context for the
Revision step next.

### Revision, diff & per-TC approval

With the matched subset confirmed, re-run the existing Analysis Protocol
above (and Figma MCP Structure Discovery, if the user gave a new Figma
link this session) scoped to just these TCs and whatever new
screenshot/description the user gave — same mechanics as fresh generation,
narrower input.

For each TC in the matched subset, compare its current field values
against what the Analysis Protocol now suggests. Only compare fields that
can meaningfully change: `title`, `expected_result`,
`steps_to_reproduce`, `test_data`, `note`, `type`. Show the user one TC at
a time, old vs. new, omitting unchanged fields:

```
TC-001 — "Back to business" link navigates to the Processed Pineapple business page

  expected_result:
    - old: Clicking "Back to business" navigates to /en/business/processed-pineapple.
    + new: Clicking "Back to business" navigates to /en/business/great-giant-pineapple.

  Apply this revision? (yes/no)
```

Wait for an explicit yes/no **before showing the next TC** — this is a
per-TC gate, not a batch review. If the user says no, record that TC as
rejected and leave its entry completely untouched during write-back
(below); move on to the next TC in the subset.

If the Analysis Protocol surfaces a state that doesn't correspond to any
TC in the matched subset (a genuinely new state, e.g. a new component
variant), do not fold it into an existing TC's diff. Present it as its own
addition prompt instead:

```
New state found: "Card shows out-of-stock badge"
  This doesn't match any existing TC in this module.
  Add as a new test case? (yes/no)
```

If approved, it gets the next available `tc_id` — see "Write-back" below
for the exact allocation rule. If rejected, discard it; do not add it
under any TC.

After every TC in the subset (and any new-state prompts) has been
answered, show an end-of-session summary: which `tc_id`s were revised,
which were added (with their new IDs), and which were rejected. This
summary is the traceability record for the session — there is no
separate file for it, same as the existing Traceability Summary for
PRD-driven generation above.

If any `tc_id`s were revised or added, offer to sync them to Notion:
propose running
`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py --update --tc-ids <revised/added ids>`
from `${CLAUDE_PLUGIN_ROOT}/scripts/`, and only run it after the user
confirms — this pipeline is confirm-before-write throughout, and syncing
Notion is no exception. If the user declines or there's nothing to sync
(everything rejected), skip it; state either outcome plainly so it isn't
mistaken for automatic propagation.

### Write-back

Approved changes are written to **both** `testcases.json` and the
matching `docs/test-cases/[page].md` — same dual-write fresh generation
already does (see "Saving Output to File" below), except entries are
edited in place instead of only ever appended.

**`testcases.json` — replace by `tc_id`, append for new states:**

```python
import json

def replace_by_id(data, tc_id, new_fields):
    for i, e in enumerate(data):
        if e.get("tc_id") == tc_id:
            data[i] = {**e, **new_fields}
            return data, True
    return data, False  # tc_id not found — stop and report, don't silently no-op

def append_new(data, new_entry):
    max_num = max(int(e["tc_id"].split("-")[1]) for e in data if e.get("tc_id"))
    new_entry["tc_id"] = f"TC-{max_num + 1:03d}"
    data.append(new_entry)
    return data

with open("testcases.json") as f:
    data = json.load(f)

# one call per approved revision:
# data, ok = replace_by_id(data, "TC-001", {"expected_result": "...", ...})

# one call per approved new state:
# data = append_new(data, {"title": "...", "module": "<confirmed module>", ...})

with open("testcases.json", "w") as f:
    json.dump(data, f, indent=2)
```

Never regenerate the whole array from scratch — only touch the specific
objects the user approved. `replace_by_id` returning `False` means the
`tc_id` wasn't found; stop and tell the user rather than silently
skipping (this shouldn't happen if the matching above ran correctly, so
treat it as a bug signal, not a normal branch).

**`docs/test-cases/[page].md` — replace by heading, append for new
states:** find the `## TC-[id] · [title]` block for each approved
revision and replace its body (Expected Result / Category / Prerequisites
/ Steps / Test Data / Automatable) with the new values, keeping the
heading's `tc_id` unchanged even if the title text changed. Match the
heading on the numeric part of the ID (e.g. `1` from `TC-001`), not a
literal string match — older markdown may still use a different
digit-padding (e.g. `TC-01`) than the current 3-digit `tc_id` convention
(see "JSON output field mapping" below), so a literal match against
`TC-001` can silently fail to find what is really the same TC. If no
heading matches a given `tc_id`, **stop and tell the user** rather than
silently skipping it — mirror `replace_by_id`'s `False`-return handling
above; the md side should fail loudly the same way the JSON side does.
For approved new states, append a new `## TC-[id] · [title]` block at
the end of the file's TC list, using the same `tc_id` allocated for
`testcases.json` above — the two files must never disagree on IDs.

This pass writes to Notion only via the confirm-before-write offer
described above (`--update --tc-ids <revised/added ids>`, run after the
user says yes) — it never writes to Notion on its own. It does **not**
edit any Playwright spec file, which stays out of scope for this mode
(see the design doc's Non-Goals). State whichever outcome applies
plainly in the end-of-session summary so it isn't mistaken for automatic
downstream propagation. The next time `playwright-from-testcases`
automation runs for this module, its existing idempotency check will
flag any spec file whose TC content
has since changed — that's the mechanism that catches this, not anything
in this skill.

### Error handling

- **No module match at all** (Matching — Module, zero matches): already
  covered above — list existing module names, ask the user to pick or
  confirm a new module. Never silently create one.
- **Keyword narrow matches zero TCs** (Matching — Keyword narrow):
  already covered above — offer the whole-module fallback.
- **Matched `testcases.json` entries have no `tc_id` field.** Check as
  soon as a module is confirmed, before keyword narrow or any later
  matching step, **scoped to that module** — a
  real project's `testcases.json` is a canonical multi-module store, and
  can have some modules tagged with `tc_id` and others not (see "Saving
  Output to File" below, where a user hitting an untagged file can choose
  to "append into the same file anyway starting at `TC-001`" — that's
  exactly how a file ends up mixed). A whole-file scope would block
  re-check for every other, correctly-tagged module just because one
  unrelated module in the same file is untagged:

  ```python
  import json

  def missing_tc_id_count(path="testcases.json", module=None):
      with open(path) as f:
          data = json.load(f)
      scope = [e for e in data if module is None or e.get("module") == module]
      missing = [e for e in scope if not e.get("tc_id")]
      return len(missing), len(scope)
  ```

  Call it scoped to the module confirmed in "Matching — Module" above,
  e.g. `missing_tc_id_count("testcases.json", module="<confirmed
  module>")`. If it returns any missing entries within that module's
  scope, **stop before showing any diff** and ask the user how to
  proceed — this mirrors the existing rule in "Saving Output to File"
  below for a fresh-generation session hitting the same problem. Re-check
  specifically depends on stable `tc_id`s to know what to replace; there
  is no safe guess here. This condition arises whenever a fresh-generation
  session appended into an untagged file via the "append anyway starting
  at `TC-001`" fallback in "Saving Output to File" below — check the
  actual file in front of you rather than assuming either state, since a
  canonical `testcases.json` can gain or lose untagged modules over time
  as it's regenerated or merged across projects. The `module=None` default
  still allows a whole-file check for the case where no module has been
  confirmed yet.
- **User names an area with no existing TCs anywhere** (module match and
  keyword narrow both come back empty even after the user confirms the
  module name is correct): this isn't a re-check. Tell the user it looks
  like fresh generation instead, and confirm before switching Step -1.5's
  branch.

---

## Output Format

Generate test cases using this exact format. Assign sequential IDs.

```
## TC-[NN] · [Concise Test Case Title]

**Expected Result:**
[What should happen when this test case passes — be specific]

**Category**
- [UI/Accessibility | Functionality | Validation | Edge Case | Performance]

**Prerequisites**
- [Any setup needed: login state, data existing in system, feature flag, etc.]
- List "None" if no prerequisites

**Steps:**
1. [Action]
2. [Action]
3. [Observe/Verify]

**Test Data**
- [Specific input values to use, e.g. Email: test@example.com, Name: ""]
- List "N/A" if no specific data needed

**Automatable**
- [Yes — [Tool name, e.g. Playwright] | No — [brief reason, e.g. requires visual verification / subjective UX judgment]]

**Requirement**
- [Requirement id(s) this TC traces to, e.g. US-C-007.2 — see Step -2]
```

Write the `Requirement` block **only when a PRD was ingested in Step -2**.
With no PRD there is nothing to trace to, so omit the whole block — do not
write "N/A" or an empty bullet. Pure-vision output therefore stays
byte-identical to what this skill produced before the field existed.

It sits last, next to `Automatable`, because both describe the TC rather
than forming part of the test itself.

This block carries the same value as the JSON's `source_requirement` (see
the field mapping below). Both are written from the same in-memory data —
the markdown is never parsed to build the JSON — so the two cannot drift.

---

## Coverage Targets (per section/screen)

Aim to produce test cases covering ALL of the following that apply:

| Area | What to Cover |
|---|---|
| **Happy Path** | Normal successful flow, all fields valid |
| **Validation** | Required fields, format rules, length limits |
| **Error States** | What happens when server/API returns error |
| **Empty States** | No data, first-time user, cleared form |
| **Edge Cases** | Boundary values, special characters, very long strings |
| **UI Fidelity** | Labels match design, correct placeholder text, correct button labels |
| **Accessibility** | Keyboard nav, screen reader labels, color contrast |
| **Responsive** | If design implies mobile/tablet |
| **Permissions** | If roles or auth are implied in design |

Minimum test cases per section: **8–12**. For complex forms or data tables: **15+**.

---

## Numbering Across Multiple Images

If the user uploads multiple images in sequence (sections of the same page):
- Continue TC numbering across images (TC-01 through TC-N, not restarting at 01 per image)
- Add a section header above each image's test cases: `# Section: [Section Name]`

---

## Review Pass (fresh generation only, size-gated)

Runs after all test cases for this session are drafted (every image/section
processed, Coverage Targets and Reconciliation Protocol above already
applied) and before "Saving Output to File" below writes anything to disk.
Does not apply to Re-check Mode — that path already gates every change
through its own per-TC approval loop ("Revision, diff & per-TC approval"
above), which serves the same purpose at a narrower scope.

**Trigger:** only when this session's draft TC count is **15 or more**
(matches the "complex forms/data tables" threshold in Coverage Targets
below — tune if that number stops fitting real sessions). Below that, skip
this whole section — no subagent, no behavior change from today.

**Dispatch:** spawn one fresh `general-purpose` Agent — not a fork, and not
yourself continuing inline. It must not have seen the generation reasoning;
a reviewer that just wrote these TCs tends to rubber-stamp its own work,
where a reviewer seeing only the finished list catches near-duplicates and
gaps the way a second person would. Give it, as plain text/JSON in the
prompt (no image needed — everything it needs is already text at this
point):
- The full draft TC list (all fields from the Output Format above)
- The Coverage Targets checklist (below)
- The PRD reconciliation checklist from Step -2, if a PRD was ingested
- This fixed brief: flag (a) any two TCs that test the same behavior in
  different wording as duplicate-merge candidates, (b) any Coverage
  Targets row or PRD requirement with no matching TC as a gap, (c) any TC
  whose expected result is vague or unfalsifiable as a quality issue.
  Return findings only — no rewrites, no file edits.

**Resolving findings:** if the subagent returns zero findings, proceed
straight to "Saving Output to File" with no interruption. Otherwise, walk
the user through each finding one at a time — same per-item confirm
pattern as "Revision, diff & per-TC approval" above:
- **Duplicate pair** — show both TCs' title + expected result side by
  side, ask which to keep (or keep both, if the user judges them
  genuinely distinct — the subagent can be wrong).
- **Gap** — show the uncovered Coverage Targets row or requirement ID,
  ask whether to generate a TC for it now (re-run the Analysis Protocol
  scoped to just that gap) or accept the gap and move on.
- **Quality issue** — show the vague expected result, ask whether to
  sharpen it now (propose a concrete rewrite) or leave it as-is.

All of this happens against the **in-memory draft list**, before anything
is written — no `replace_by_id`/file diffing needed here, unlike Re-check
Mode's write-back (that mechanism exists there because Re-check Mode edits
an already-saved file; here nothing is saved yet). Once every finding is
resolved, the — possibly revised — draft list proceeds to "Saving Output
to File" as normal.

End-of-session summary (same place as the existing Traceability Summary /
Re-check summary): one short line noting the review ran, how many findings
it raised, and how each was resolved (merged / kept-both / gap-filled /
gap-accepted / sharpened / left-as-is). Omit this line entirely when the
review didn't run (below threshold).

---

## Saving Output to File

After generating all test cases, **always save the output in both formats, simultaneously**:
1. `docs/test-cases/[page-name].md` — human-readable, git-friendly
2. `testcases.json` (repo root) — the canonical test-case store consumed by
   all three steps, not just the Notion-upload script (see
   `${CLAUDE_PLUGIN_ROOT}/scripts/upload_testcases_to_notion.py`)

You already hold all TC data at generation time (title, module, type,
expected result, steps, test data, prerequisites, note, Automatable, and —
when applicable — source_requirement/source_type) — do not re-parse the
markdown to build the JSON, build both from the same in-memory data.

### File location
- Markdown directory: `docs/test-cases/` (create if it doesn't exist) — kept
  out of `e2e/` deliberately, since `e2e/` is the self-contained Playwright
  package (its own `package.json`, fixtures/pages/tests) and this markdown
  is a documentation artifact from Step 1, not test code
- Markdown filename: derived from the **page or section name(s)** covered by the test cases
- JSON path: always `testcases.json` at the repo root (fixed, canonical path — same file `upload_testcases_to_notion.py` reads by default)

### Filename rules (markdown)
- Use the page/section name as the base (e.g. the screen name, form name, or section header)
- kebab-case, lowercase, no spaces: `login-page.md`, `user-profile-form.md`, `dashboard-table.md`
- Multiple sections from the same page → single file named after the page: `checkout-page.md`
- Multiple unrelated pages in one session → one file per page
- If the user explicitly provides a name, use that exactly (kebab-cased)

### Markdown file content
The markdown file should contain:
1. A top-level heading: `# Test Cases — [Page / Section Name]`
2. Metadata block:
   ```
   **Generated:** [date]
   **App type:** [web / mobile / desktop]
   **Test tool:** [tool name or Manual]
   ```
3. All generated test cases in the standard TC format

### JSON output field mapping

Each TC in the markdown output maps to one JSON object with this shape (same
schema as `${CLAUDE_PLUGIN_ROOT}/scripts/sample_testcase_structure.json`):

| JSON field | Source (from TC format above) |
|---|---|
| `tc_id` | The TC's own ID, formatted `TC-001` (zero-padded to 3 digits) |
| `title` | The TC heading text (`## TC-[NN] · [Title]` → `[Title]`) |
| `module` | Page/section name this TC belongs to |
| `type` | The `**Category**` value |
| `automatable` | `"Yes"` or `"No"`, parsed from the `**Automatable**` field's leading Yes/No |
| `status_chrome` / `status_firefox` / `status_safari` | Always `"Not started"` |
| `expected_result` | The `**Expected Result:**` block |
| `steps_to_reproduce` | The `**Steps:**` list, as a JSON array of strings |
| `test_data` | The `**Test Data**` block |
| `prerequisites` | The `**Prerequisites**` block |
| `note` | Any `> ⚠️ Design Note` for this TC, or `""` if none |
| `source_requirement` | The `**Requirement**` block's value — requirement id(s) this TC traces to, using whichever scheme Step -2 settled on (PRD-native like `"US-C-007.2"`, or minted `"REQ-3"`). `""` if no PRD was provided, matching the omitted markdown block |
| `source_type` | `"figma"` \| `"prd"` \| `"figma+prd"` — defaults to `"figma"` for the existing pure-vision path, so nothing existing breaks |

`tc_id` numbering follows the same sequence as the markdown TC numbering
(continues across images/sections in a session, never restarts).

### After saving
- Confirm to the user: `Saved to docs/test-cases/[filename].md and testcases.json`
- If either file already exists (resuming a session), **append** new test cases
  to both — continue the TC numbering sequence (and `tc_id` sequence) from
  where the files left off. Never restart `tc_id` numbering when appending —
  read the last `tc_id` in the existing JSON array and continue from `+1`.
- **If the existing JSON's entries have no `tc_id` field at all** (an older
  file predating this convention, or from a different generator/project —
  confirmed to happen in practice 2026-08-05), do not treat that as "start
  from 0" and silently renumber into the same array. Stop and ask the user
  how to proceed: start this session's numbering at `TC-001` in a **new,
  separate file** (recommended — keeps this project's TCs from mixing with
  the untagged ones), append into the same file anyway starting at `TC-001`,
  or replace the file entirely. Don't guess; the existing entries may belong
  to a different, unrelated project.

---

## Tips for Better Output

- **Be specific in steps** — "Click the Submit button" not "Submit the form"
- **Be specific in expected results** — "A green success toast appears saying 'Profile saved'" not "Success message appears"
- **Use real-looking test data** — actual email addresses, realistic names, realistic edge case strings like `<script>alert(1)</script>` for XSS, `""` for empty, `99999` for max number
- **Name what you can't see** — if a design implies a backend (e.g. a login form), include test cases for network errors, wrong credentials, locked accounts
- **Call out design ambiguities** — if something in the design is unclear (e.g. "it's not clear if this field is required — recommend designer adds an asterisk"), add a note at the end of the section as `> ⚠️ Design Note: ...`

---

## Reference: Category Definitions

| Category | Use When |
|---|---|
| UI/Accessibility | Testing visual fidelity, labels, contrast, keyboard/screen reader |
| Functionality | Testing that features work as intended |
| Validation | Testing input rules, required fields, formats |
| Edge Case | Boundary values, unexpected inputs, extreme states |
| Performance | Load time, large data sets, slow network behavior |
| Security | XSS, SQL injection, unauthorized access |
