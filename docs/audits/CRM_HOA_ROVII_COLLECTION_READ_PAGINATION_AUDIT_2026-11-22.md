# Collection Read and Pagination Audit — 2026-11-22

**Scope:** Full-collection Firestore reads in dashboard, order list and customer list.  
**Environment:** Source-code audit and synthetic Emulator tests only.  
**Production safety:** No production records were read or changed.

## 1. Findings

| Surface | Current read | Client behavior | Risk |
|---|---|---|---|
| Dashboard | Previously `listOrders()` for the entire collection | Computes today's KPIs and renders six newest | Fixed by PR #15 |
| `/orders` | `listOrders()` orders by `createdAt desc`, then downloads all documents | Status filter plus substring search over order ID, customer name and phone | Reads and memory scale with lifetime orders |
| `/customers` | `listCustomers()` orders by `createdAt desc`, then downloads all documents | Substring search over name, phone and address | Reads and memory scale with lifetime customers |
| Customer detail | `listOrdersByCustomer(customerId)` loads one customer's full history | Displays customer-specific history | May grow for high-frequency customers, but narrower than global collection |

The order/customer list pages use client-side substring search. Simply adding `limit(50)` would silently change the search contract: a matching record outside the loaded page would appear not to exist.

## 2. Completed optimization — PR #15

- Added `getDashboardOrders(dayStartInclusive, dayEndExclusive)`.
- Dashboard reads all orders in the local calendar-day range plus the six newest orders, rather than downloading every order.
- Day boundaries are local midnight and next local midnight converted to ISO UTC strings, so stored UTC timestamps are compared against the intended local day.
- Emulator Case P verifies day-range inclusion/exclusion, descending order and the six-newest limit.
- PR #15 merged at `4ce6d95095141180cb855426bff8c94c722b880b`; PR CI #44985805872 and post-merge main CI #44986041575 PASS.

## 3. Orders/customers pagination choices

Cursor-based pagination should use Firestore `orderBy('createdAt', 'desc')`, `limit(pageSize)`, and a `DocumentSnapshot` cursor (`startAfter`) so equal timestamps remain deterministic. However, the current search contract requires a product decision:

1. **Preserve global substring search:** keep fetching pages until all records have been scanned when a search is active. This preserves behavior but does not reduce reads for broad searches.
2. **Move to indexed prefix/exact search:** add normalized searchable fields and query by prefix/exact phone/order ID. This improves reads but changes substring semantics and may require a controlled backfill for legacy records.
3. **Search loaded pages only:** show a clear loaded-record count and explicit “load more” affordance. This is the smallest implementation but changes user expectations unless the UI communicates the scope.

**Recommendation:** implement cursor pagination for normal browsing, but do not silently adopt option 3. If product accepts a search-contract change, prefer normalized prefix/exact search (option 2); otherwise retain full-scan behavior only while a search is active.

## 4. Additional technical constraints

- Keep existing descending `createdAt` order and status filters.
- Use snapshot cursors rather than offset pagination; Firestore offsets still read skipped documents.
- Ensure query indexes are committed and Emulator-tested.
- Customer detail history can be paginated independently later without affecting global search.
- Do not add Algolia or another paid search service without explicit approval.
- Do not backfill production search fields or deploy schema changes without a reviewed migration plan.


## 5. Cursor pagination implementation (PR #16)

- Added `listOrdersPage()` and `listCustomersPage()` using `createdAt desc`, Firestore snapshot cursors, and a default page size of 50 (maximum 100).
- Normal browsing loads the first 50 records and exposes an explicit “Tải thêm” action. The extra look-ahead document determines `hasMore` without skipping a record between pages.
- To preserve current global substring search and status-filter behavior, activating search or a non-default order status loads the complete collection and applies the existing client-side filter. Clearing all filters returns to the first cursor page. This intentionally means broad searches still read the full collection.
- Emulator Case Q seeds eight orders and seven customers, traverses pages of three, and checks ordering, page sizes, no duplicates/skips, and correct final-page behavior.
- PR #16 and CI status will be recorded after final-head verification and merge.
