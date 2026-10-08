---
name: review-checklist
description: Claude's judgment pass over a launch-check run. Reads evidence.json and report.json from a run folder, decides pass, fail or unsure for each review-needed row using only the captured evidence, writes review.json and merges it into the report. Used by pre-launch-check and post-launch-check after the engine run; also for "review the checklist run".
---

# Review checklist

Input: a run folder such as `launch-check/pre/2026-10-08` (ask for it if not given).

## Rules
- Use **only** facts in `evidence.json`. If the evidence cannot answer the question, answer `unsure` and say what a human should check. Never guess and never browse the site.
- Be conservative: `fail` only when the evidence clearly contradicts the expectation.
- Keep each reason to one sentence and name the page URL when it matters.

## Steps

1. Read `<dir>/report.json` and list rows with `status: "review-needed"` and `type: "review"` (skip rows whose reason says PageSpeed or HTTPS could not be checked; they are not review-type rows).
2. Read `<dir>/evidence.json` and decide each row:

   | Row | Evidence to use | Pass when |
   | --- | --- | --- |
   | SEO-003 | home page `title` | relates to the site and uses a "Name | tagline" style |
   | SEO-004 | non-home page `title`s | each title names its own page |
   | SEO-008 | `headings` per page | h2 count is balanced; more than 3 h2 only if the content is clearly flat |
   | SEO-010 | `breadcrumb` text, `url` depth | present on nested pages and shows each level |
   | SEO-011 | `url`s of detail pages | readable hyphenated slugs, no ids or query noise |
   | SEO-013 | image `alt` vs `src` file name and nearby headings | alt describes the image rather than being a file name or "image" |
   | SEO-014 | `favicon` | present, and not a framework default (for example a Next.js, Laravel or WordPress logo path) |
   | MAP-001 | `mapEmbeds` and page `url` | pages that mention a map or contact info contain at least one embed |
   | IMG-003 | image `width`/`height` vs `naturalWidth`/`naturalHeight` | rendered aspect ratio within 5% of natural; no image rendered more than 2x its natural size |
   | UI-009 | `bodyText` | no placeholder wording ("your text here", "sample", "TBD", "coming soon" blocks) |
   | UI-016, UI-017 | `forms` | `unsure`: error messages only appear after submitting, which a crawl does not do |

3. Write `<dir>/review.json` as an array of `{ "id": "SEO-003", "status": "pass" | "fail" | "unsure", "reason": "..." }`, one entry per decided row.
4. Merge: `node ${CLAUDE_PLUGIN_ROOT}/vendor/launch-checks/cli.js merge-review <dir>`.
5. Tell the user how many rows moved to pass / fail and how many stay `review-needed`.
