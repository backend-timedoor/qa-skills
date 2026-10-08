# Launch Check Plugins: Design

Date: 2026-10-08
Status: Draft, awaiting review

## 1. Goal

Turn the two Timedoor website checklists in `docs/` (`Before Launch Testing Checklist.csv`, `After Launch Testing Checklist.csv`) into two new Claude Code plugins in the `qa-skills` marketplace:

- `pre-launch-check`: for dev/staging sites before launch.
- `post-launch-check`: for production sites after launch.

Each plugin crawls a site, runs the checklist rows it can verify, has Claude review the judgment rows from captured evidence, lists the rest as manual, and writes a report. Results can optionally be synced to a Notion checklist database.

The user picks the phase by choosing the plugin. A guard warns when the target site looks like the wrong phase.

## 2. Decisions

| Topic | Decision |
|---|---|
| Plugin split | One plugin per checklist (`pre-launch-check`, `post-launch-check`) |
| Shared logic | Single source in `shared/launch-checks/`, copied into each plugin by `sync.sh`; CI fails on drift |
| Execution | Hybrid: deterministic Playwright runner for evidence and mechanical checks; Claude reviews judgment rows from evidence only |
| Page scope | Crawl from base URL (sitemap, then internal links) up to a page cap, plus optional explicit URL list |
| Output | Local `report.json` + `report.md` always; Notion sync optional |
| Notion | Separate sync script and database from the test-case uploader; same token style, own database ID |

## 3. Repository layout

```
.claude-plugin/marketplace.json        # add both plugins
shared/launch-checks/                  # source of truth, not shipped as a plugin
  checks/                              # one module per check
  runner/                              # crawler + evidence capture + report writer
  notion/                              # sync_checklist_to_notion.py
  sync.sh                              # copies shared/ into plugins/*/vendor/
plugins/pre-launch-check/
  .claude-plugin/plugin.json
  phase.json                           # rows + expectations for pre-launch
  vendor/                              # synced copy of shared/launch-checks
  skills/setup-pre-launch-check/SKILL.md
  skills/pre-launch-check/SKILL.md     # run + report
  skills/review-checklist/SKILL.md     # Claude judgment pass
  templates/launch-check.config.example.json, notion.env.example
plugins/post-launch-check/             # same shape, own phase.json
docs/plugins/pre-launch-check/index.html
docs/plugins/post-launch-check/index.html
```

Plugins install in isolation and cannot import from each other, so `vendor/` holds a full copy. `sync.sh --check` exits non-zero if any `vendor/` differs from `shared/`; it runs in CI and as a pre-commit hook.

## 4. Check model

Each CSV row gets a stable ID (e.g. `SEO-001`) and a type:

- `auto`: the script decides pass/fail and records a reason and affected pages.
- `review`: the script captures evidence; Claude decides pass/fail/unsure with a one-line reason.
- `manual`: needs a human or Figma; listed as `manual-todo` with the original steps.

`phase.json` lists the rows for a phase and per-phase expectations. The check modules are phase-agnostic and read expectations from it.

### Row classification

| Group | Row | Type | Phase notes |
|---|---|---|---|
| SEO | Meta title and description present | auto | both |
| SEO | Meta keyword on homepage (2-5 keywords) | auto | both |
| SEO | Home page title format | review | both |
| SEO | Other page title relevant to page | review | both |
| SEO | H1 present on every page | auto | both |
| SEO | H1 unique across pages | auto | both |
| SEO | Exactly one H1 per page | auto | both |
| SEO | H2 count balanced, structure sensible | review | both |
| SEO | Heading order (no skipped or inverted levels) | auto | both |
| SEO | Breadcrumb present, level by level, clickable | review | both |
| SEO | Product/item URL follows SEO policy | review | both |
| SEO | Images have relevant alt | auto (present) + review (relevant) | both |
| SEO | Favicon is project identity | review | both |
| SEO | Footer credit on homepage ("Powered by PT Timedoor Indonesia", link target blank, same color as text) | auto | both |
| SEO | No footer credit on other pages | auto | both |
| SEO | OG title, type, image, url on every page | auto | both |
| SEO | No duplicate meta tags | auto | both |
| Basic Auth | Basic auth visible on dev site | auto | pre only |
| Analytics | Google Analytics script present | auto | post only |
| Google Map | Maps appear on pages that contain them | review | both |
| Crawling | robots.txt | auto | pre: disallow / post: allow |
| Crawling | Meta robots and googlebot | auto | pre: `noindex, nofollow` / post: `index, follow` |
| Captcha | reCAPTCHA script present | auto | both (post: message must also send, `manual`) |
| Links | No broken links | auto | both |
| Links | 404 page shown for unknown URL | auto | both |
| HTTPS | http redirects to https | auto | both |
| HTTPS | http://www redirects to https non-www | auto | both |
| Performance | PageSpeed mobile at least 55, desktop at least 85 | auto | both (thresholds configurable) |
| Images | Most images at most 100 KB, hero/large at most 200 KB | auto | both |
| Images | Lazy loading used below the fold | auto | both |
| Images | Quality / not stretched | review | both |
| Images | Admin crop shown correctly after upload | manual | both |
| UI/UX | Color, font, JP font, letter spacing and line height, hover and disabled button, margin and padding vs Figma | manual | both |
| UI/UX | Real content, no lorem ipsum | auto (lorem detection) + review | both |
| UI/UX | Contrast, hover on cards, active menu, active tab | manual | both |
| UI/UX | Tablet and mobile responsive | manual | both |
| UI/UX | Error messages related to the action | review | both |
| UI/UX | Login error does not reveal which field is wrong | review | both |
| UI/UX | Clickable elements easy to click | manual | both |
| UI/UX | English date format MM/DD/YYYY or Month Date, Year | auto | both |

Where one row has two parts, it is split into two IDs so each has a single type.

## 5. Configuration

`launch-check.config.json` in the project root:

```json
{
  "baseUrl": "https://staging.example.com",
  "pageCap": 30,
  "extraUrls": ["https://staging.example.com/contact"],
  "figmaUrl": "",
  "language": "en",
  "thresholds": { "pagespeedMobile": 55, "pagespeedDesktop": 85, "imageKb": 100, "heroImageKb": 200 }
}
```

Secrets (basic auth user/password, PageSpeed API key, Notion token, `NOTION_CHECKLIST_DB_ID`) live in `.env` files created from templates and are never written into reports.

## 6. Run flow

1. **Preflight.** Config and Playwright present; announce the phase. Wrong-phase guard: pre-launch run on a site whose meta robots or robots.txt allows indexing, or post-launch run on a site that is `noindex`/behind basic auth, prints a warning and asks to continue.
2. **Crawl.** Read `sitemap.xml`; fall back to internal links; merge `extraUrls`; stop at `pageCap`. Basic auth applied from `.env`.
3. **Evidence capture** into `launch-check/<phase>/<date>/evidence.json`:
   - per page: status, title, meta tags (incl. duplicates), headings, OG tags, images (src, alt, bytes, loading attribute, rendered vs natural size), links, footer text and link attributes, text samples;
   - per site: robots.txt, http/www redirect results, 404 response, captcha and GA scripts, PageSpeed mobile and desktop.
4. **Auto checks.** Pure functions of evidence, each returning `{id, status, reason, pages[]}`.
5. **Claude review.** The `review-checklist` skill reads `evidence.json` and the `review` rows and writes `pass`, `fail` or `unsure` plus a one-line reason per row. It may not use facts outside the evidence file.
6. **Manual list.** `manual` rows are emitted as `manual-todo` with steps and the Figma link.
7. **Report.** `report.json` and `report.md` in the same folder.

## 7. Report format

Rows keep the CSV grouping. Each row has: ID, group, check, type, status (`pass`, `fail`, `review-needed`, `manual-todo`, `n/a`, `error`), pages affected, evidence excerpt, note. The top of `report.md` shows counts per status and the list of failures.

## 8. Notion sync

`sync_checklist_to_notion.py` (Python, same dependencies as the existing uploader):

- Database properties: Run date, Phase, Site, ID, Group, Check, Status, Pages affected, Evidence, Reviewer.
- Page identity: `site + phase + run date + row ID`. Re-syncing updates instead of duplicating.
- `--dry-run` prints planned creates/updates without writing.
- `pull` command reads only Status and Reviewer back into `report.json`, so tester edits to `manual-todo` rows are kept and never overwritten by a push.
- Nothing is sent unless sync is explicitly run.

## 9. Error handling

- A throwing check yields an `error` row with the message; the run continues.
- Unreachable pages, timeouts and auth failures are recorded per page in the evidence file.
- PageSpeed rate-limit or outage: row becomes `review-needed` with a link to run it manually.
- Crawl is bounded by page cap and per-request timeout.

## 10. Testing

- Unit tests per check module against small HTML fixtures with known pass and fail cases.
- Local fixture site with pre-launch and post-launch variants for an end-to-end crawl, check and report test.
- Drift test: `shared/launch-checks` equals each plugin's `vendor/`.
- Notion sync tested with a mocked client; one manual smoke test against a real database.

## 11. Out of scope (first version)

- Automated Figma comparison (colors, fonts, spacing, letter spacing, hover states).
- Automated contrast scoring and responsive layout judgment.
- Authenticated areas beyond basic auth.
- Auto-detecting the phase (only the wrong-phase warning).

## 12. Release steps

- Add both plugins to `marketplace.json`, version `0.1.0` each.
- Add landing pages under `docs/plugins/` and link them from `docs/index.html`.
- Update `README.md` with install and usage for both plugins.
