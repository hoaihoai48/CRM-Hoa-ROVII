# GOAL — CRM Hoa ROVII

**Repository:** `hoaihoai48/CRM-Hoa-ROVII`  
**Default branch:** `main`  
**Purpose:** Maintain and improve the CRM used to operate the ROVII flower shop.

This file records the durable product goal and priorities. It is not a substitute for the live task status in [HANDOFF.md](HANDOFF.md).

## Product outcome

Deliver a dependable, easy-to-operate internal CRM that lets the ROVII team manage the daily flower-shop workflow end to end:

1. **Products:** maintain the catalog, prices, units, categories, images and active/inactive state.
2. **Customers:** create and maintain customer profiles, find customers quickly, and inspect their complete order history.
3. **Orders:** create, view, edit and progress orders through valid lifecycle states; preserve accurate totals, timestamps and actor history; provide usable print output.
4. **Staff and access:** authenticate staff and enforce admin/staff permissions consistently in the UI, service layer and Firebase Rules.
5. **Dashboard:** present useful operational summaries without unbounded database reads.
6. **Store settings:** maintain the store information and configuration needed by daily operations.
7. **Operational quality:** make critical workflows reliable on desktop and mobile, with clear loading, empty, validation and error states.

## Engineering objectives

- Keep the architecture understandable and maintainable; prefer the smallest complete solution over speculative abstractions.
- Preserve order lifecycle correctness, transaction atomicity, customer identity consistency, canonical order history and pagination.
- Treat Firestore Rules, service code, types, UI behavior and tests as one system.
- Use Firebase Spark-compatible architecture. Do not add paid Firebase services or require a billing upgrade without explicit owner approval.
- Keep security claims proportional to what the deployed architecture can actually enforce.
- Cover critical user journeys with isolated Firebase Emulator tests and Playwright E2E; maintain lint, typecheck and production build quality gates.
- Keep GitHub Actions and Vercel usage economical. Do not create repeated CI runs to probe speculative fixes.
- Keep durable project knowledge in `GOAL.md`, `lessons.md` and `HANDOFF.md`.

## Delivery priorities

The active priority order is:

1. Close known security and data-integrity gaps with designs that fit Firebase Spark and the internal-team threat model, starting with staff membership identity/immutability (F-04).
2. Align historical security-audit documentation with the actual Spark client-transaction architecture and accepted trust boundary (F-05).
3. Strengthen E2E coverage for products, customers, staff and store settings, in addition to authentication and orders.
4. Continue improving usability and responsive behavior in the actual daily workflows.
5. Reassess larger architecture changes only when a concrete operational need justifies them.

The exact current state, blockers, PRs, SHAs and next action belong in [HANDOFF.md](HANDOFF.md), not in this long-lived goal file.

## Non-negotiable safety boundaries

- Never deploy to production, mutate production customer/order data, perform destructive migrations, change Firebase project configuration or change billing without explicit approval.
- Run automated tests only against the explicit demo Firebase project and loopback emulators with synthetic data.
- Never commit secrets, real customer data or production credentials.
- Do not merge a failed, pending, stale or insufficiently reviewed change.
- Report what is merged to `main` separately from what exists only on a branch or open PR.
