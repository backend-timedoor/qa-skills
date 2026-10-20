# Tester Estimation Guide

Calibrated on a reference inquiry: a B2C e-commerce site (Next.js + Laravel) with a card payment gateway, a multi-courier shipping aggregator and an MLM point-distribution API. Hours are Tester hours **without** retest (AI-generated test cases + review, one execution cycle, black-box). Adjust up or down by the number of scenarios in the PRD, not by FE hours.

## Contents
1. Hours per task type
2. Black-box exclusions (not QA's job)
3. De-duplication rules
4. QA process activities
5. Full calibration example

## 1. Hours per task type

| Task type | Hours | Notes |
|---|---|---|
| Static content page (landing, blog detail) | 2–4 | Sections render, CTA links, responsive |
| Listing with search/filter/pagination/empty state | 3–4 | |
| Item detail with add to cart | 2.5–4 | Qty vs stock, inactive item |
| Global layout + cross-browser on key pages | ~5 | Latest 2 versions of Chrome/Safari/Firefox/Edge + mobile 360 px, key pages only |
| Login / logout | 1.5 | Includes rate limit / lockout |
| Register | 3 | Unique fields, inputs kept on error |
| Reset password | 2.5 | Expired link tested by shortening expiry on staging |
| Profile / edit-own-data form | 2.5 | |
| Address book / CRUD with a "one primary" rule | 3.5 | |
| Simple admin CRUD (≤3 fields) | 1.5–2 | |
| Admin CRUD with many fields + upload + validation | 4–5 | |
| Rule CRUD (promo, free shipping) — form & validation only | 3–4 | Rule behaviour is tested in the engine |
| Business-rule engine (auto discount, combinations, quota, per-customer limit) | ~11 | Scenario matrix; stays large |
| Order state machine / status transitions | ~8 | Valid and invalid transitions, history |
| Checkout page (form, address, courier, voucher, summary, guest E2E) | ~10 | |
| Revalidation before order creation | ~6 | Price/stock/rate changed → reconfirm |
| Payment status page + gateway end-to-end | ~8 | Success, declined, page closed, expiry → cancelled & stock returned |
| Guest order tracking | 3 | |
| RBAC, 3 roles across modules | ~6 | Matrix generated from the spec's permission matrix |
| Audit log (filter, detail, read-only) | 2.5 | Entries come from actions tested elsewhere |
| Dashboard widgets / notification center | 2.5–3 | |
| Report with figure reconciliation | ~5 | Detail table and CSV export ~2 each |
| Point/commission distribution E2E (order completed → sent within X s) | ~6 | |
| Transactional emails (many status templates) | ~3 | Emails fire while testing status transitions |

## 2. Black-box exclusions — Tester = 0, note the owner
- Callback signature verification, duplicate callbacks / idempotency, idempotency keys.
- Timeouts, error-code mapping, retry/backoff intervals, queue mechanics.
- Payload/log sanitisation, credential masking in logs, password hashing, CSRF.
- Sandbox vs production adapter config (covered by the production smoke test).
- Reviewing the API spec document.
- Load/performance testing (p95 targets) → BE/DevOps.
- Daily backup & restore test → BE/DevOps.

QA still checks the **visible effects**: status changes, notifications appear, credentials don't show on screen, pages are refused without login, HTTP redirects to HTTPS.

## 3. De-duplication rules
Test each behaviour once — where its result is visible:
- Payment gateway → checkout and payment status pages (integration module = 0).
- Shipping/courier → checkout and revalidation; tracking number/delivered → order module.
- External ID validation → the page that shows the result (e.g. membership page).
- Special pricing (member price) in catalogue/cart/checkout → the "apply pricing" task, not every page.
- Voucher rules (period, quota, minimum spend) → the promo engine, not checkout.
- Publish/unpublish visibility → the CMS, not the public pages.
- Login lockout and per-role access → auth and RBAC, not security.
- Empty states / per-field validation → each feature; the "UI states" task is only a consistency sweep + admin cross-browser.
- Exclusions (guest/cancelled orders earn no points) → check orders already created while testing other modules.

## 4. QA process activities (the "QA - ..." row of the foundation/release module)
| Activity | Hours |
|---|---|
| Test plan & strategy | 3 |
| UAT support (scenarios 2, 2 sessions × 3, retest feedback 4) | 12 (assumes max 2 UAT sessions; +3–4 h per extra session) |
| Test report & sign-off | 3 |
| Production smoke test of critical flows + domain & sender email check | 6 (Deployment row) |
| Black-box security | 2 (Security row) |
| UI states sweep + admin cross-browser | 5 (UI States row) |

## 5. Full calibration example (without retest)

| Module | Hours | Task breakdown |
|---|---|---|
| Landing & public content | 15 | Global layout 5, Landing 4, Blog listing 4, Blog detail 2 |
| Product catalogue | 9.5 | Listing 3, Detail 4, Bundle 2.5 |
| Customer auth & account | 16 | Register 3, Login 1.5, Reset 2.5, Profile 2.5, Address 3.5, Order history 3 |
| Membership & member pricing | 12 | Membership page 4, Link ID 3, Apply pricing 5 |
| Cart & checkout | 32 | Cart 5, Checkout 10, Revalidation 6, Payment status 8, Guest tracking 3 |
| Products, bundles & stock (admin) | 15 | Admin auth 2, Category 1.5, Product 5, Bundle 4, Stock 2.5 |
| Promo & free shipping | 18 | Promo CRUD 4, Shipping rule CRUD 3, Engine 11 |
| Orders & fulfillment | 19 | List 3, Detail 2, Transitions 8, Tracking no. 3, Cancel/refund 3 |
| CMS blog & testimonials | 7.5 | Article 3, Category 1.5, Testimonial 3 |
| Internal users, roles & audit | 11.5 | Users 3, RBAC 6, Audit 2.5 |
| Dashboard & notifications | 5.5 | Dashboard 3, Notifications 2.5 |
| Sales & point reports | 9 | Sales report 5, Detail 2, CSV 2 |
| Point transaction log | 5 | Log page 2, Manual retry 3 |
| Payment / shipping / MLM integration | 0 | Tested end-to-end in membership, checkout, orders, point distribution |
| Point distribution & uplines | 12 | Snapshot 2, Job queue E2E 6, Retry 2, Exclusions 2 |
| Transactional email | 3.5 | Status templates 3, Reset 0.5, Queue 0 |
| Foundation, security & release | 31 | UI states 5, Security 2, QA (plan/UAT/report) 18, Deployment 6 |
| **Total** | **221.5** | FE total 208 h (BE not filled yet) |

Retest & regression added on top: checkout 13, promo 7, orders 7, member pricing 5, point distribution 5, internal users 3, products 3, customer auth 3, final regression 4 → **50 h**, Tester total **271.5 h**.
