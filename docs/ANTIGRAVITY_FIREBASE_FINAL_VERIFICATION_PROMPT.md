# Antigravity — Firebase Final Verification Gate

Mục tiêu: **audit → lint → typecheck → build → Firebase config/rules/indexes audit → runtime/emulator verification nếu môi trường cho phép → sửa chỉ lỗi verification chắc chắn → chạy lại toàn bộ gate → commit/push → report trung thực.**

Repository: `hoaihoai48/CRM-Hoa-ROVII`, branch `main`.

## Quy tắc
- Đọc source hiện tại trước khi sửa; không tin report cũ nếu chưa kiểm chứng.
- Không redesign UI, không đổi schema/kiến trúc lớn, không tạo mock/demo runtime.
- Không đánh dấu PASS nếu chưa có evidence.
- Không thể chạy gate vì môi trường/credential thì ghi **BLOCKED**, nêu lý do.
- Không mở rộng Firestore rules chỉ để test PASS.
- Nếu phát hiện lỗi source rõ ràng trong phạm vi verification: sửa trực tiếp và chạy lại toàn bộ gate.
- Nếu gặp vấn đề kiến trúc lớn cần quyết định riêng: không tự redesign, ghi NEEDS DECISION.
- Cuối cùng kiểm tra git diff/status; chỉ commit thay đổi liên quan.

## 1. Baseline/source audit
Fetch/pull `origin/main`, ghi baseline SHA. Đọc:
- `FIREBASE_MIGRATION_AUDIT.md`
- `docs/ANTIGRAVITY_FIREBASE_MIGRATION_PROMPT.md`
- `docs/ANTIGRAVITY_FIREBASE_FINAL_FIX_PROMPT.md`
- file prompt này.

Audit trực tiếp:
- `src/lib/services/orders.ts`
- `customers.ts`
- `products.ts`
- `settings.ts`
- `services/index.ts`
- `utils/timestamp.ts`
- `utils/order-status.ts`
- `firebase/config.ts`
- `firestore.rules`
- `firestore.indexes.json`
- dashboard/orders/orders-new/orders-id/customers/customers-id/products/products-new/products-id/settings/login/auth guard.

## 2. Mock/fake gate
Search toàn repo:
`mockOrders`, `mockCustomers`, `mockProducts`, `MOCK_`, `DEMO_`, `ANON-STAFF`, `DH-1024`, `CUST-001`, `PROD-001`, `Date.now()`, fake user/store identity, Firebase failure fallback sinh dữ liệu.
Phân biệt fixture/test hợp lệ với runtime production. Runtime production không được phụ thuộc mock/fake data.

## 3. Firebase config/auth
Verify required config, không hard-code project giả, không fake authenticated user, `auth.currentUser` là nguồn user, auth guard bảo vệ private routes, logout gọi Firebase Auth, config/auth errors được surface.

## 4. Order integrity
Audit `createOrder()`:
- customer tồn tại
- product tồn tại + active
- quantity > 0
- fee/discount không âm
- discount <= subtotal
- price lấy từ Firestore
- snapshot sản phẩm
- subtotal/total tính lại
- collision-safe IDs
- initial status/history
- order + aggregate cùng transaction
- tất cả reads trước writes.

Invariant:
- `totalOrders` = orders của customer có status != cancelled
- `totalSpent` = tổng total của orders completed
- `lastOrderDate` = createdAt lớn nhất của orders != cancelled.

Audit `updateOrderStatus()`: order/customer tồn tại, transition hợp lệ, history append, aggregate tính theo projected status, order + aggregate atomic, không có order update nếu aggregate update không thể thực hiện.

Test/verify:
`new → confirmed → delivering → completed`
và `new → cancelled`, `confirmed → cancelled`.

## 5. Customer integrity
Verify phone normalization, phone rỗng bị reject, name/address theo contract, duplicate phone không tạo document thứ hai, uniqueness check nằm trong transaction, deterministic ID không collision. Legacy duplicate không tự xoá; ghi NEEDS DATA REPAIR nếu tồn tại.

## 6. Product integrity
Verify name/price/unit validation, collision-safe ID, inactive product không tạo order, mutation errors surfaced, không fallback fake product.

## 7. Timestamp
`normalizeIsoString()`: Timestamp/Date/string/number được normalize đúng; dữ liệu thiếu timestamp **không được tự bịa thời gian hiện tại**.

## 8. Customer history/query
Customer detail phải query theo `customerId`, không tải toàn bộ orders rồi filter nếu query chuyên biệt đã có. Đối chiếu index với `firestore.indexes.json`.

## 9. UI error/loading
Audit dashboard, orders, order detail, customers, customer detail, products, product detail, products/new, settings:
- loading
- not found
- Firebase/service error
- mutation error.
Không để Firebase promise quan trọng thiếu error handling.

## 10. Firestore rules
Audit toàn bộ rules. Nếu đang `allow read, write: if request.auth != null`, đánh giá rõ rủi ro client authenticated có thể sửa aggregate/order fields trực tiếp.
**Không tự mở quyền thêm. Không tự tighten rules nếu chưa có test chứng minh không phá service contract.**
Nếu còn limitation, ghi:
**SECURITY HARDENING — NEEDS SEPARATE DECISION**.

## 11. Indexes
Đối chiếu mọi query thực tế với `firestore.indexes.json`; không thêm index thừa.

## 12. Lint/type/build
Chạy lần lượt:
```bash
npm run lint
npx tsc --noEmit
npm run build
```
Nếu FAIL, sửa lỗi thuộc phạm vi rồi chạy lại cả 3. Không disable rules/typecheck để làm PASS. Kiểm tra đặc biệt `crypto.randomUUID()`, Firebase transaction types, Input props, `useParams()`, nullable states, Firestore DocumentData.

## 13. Runtime/emulator
Kiểm tra Firebase Emulator/seed/test config. Nếu có thể chạy, dùng emulator/test environment an toàn; không destructive-test production. Nếu không thể chạy do môi trường/credential: **BLOCKED**, không suy diễn PASS.

Required scenarios nếu runtime khả dụng:
1. create customer
2. create same phone twice → không duplicate
3. create order → snapshot price + totals + aggregate
4. status chain → history + aggregates
5. cancel → aggregates đúng
6. inactive product → create order FAIL
7. missing customer → create order FAIL
8. illegal status transition → FAIL
9. unauthenticated → protected collections denied
10. concurrency: hai create customer cùng phone → một customer duy nhất; nếu không test được ghi BLOCKED.

## 14. Regression
Verify routes/imports/service exports, no circular import introduced, no accidental UI redesign, no mock/fake fallback, no fabricated timestamp.

Final search:
```bash
grep -R "Date.now()" src
grep -R "ANON-STAFF" src
grep -R "mockOrders\|mockCustomers\|mockProducts" src
grep -R "DH-1024\|CUST-001\|PROD-001" src
```
Phân loại từng match, không chỉ đếm.

## 15. Final report
Tạo/cập nhật `FIREBASE_FINAL_VERIFICATION_REPORT.md`.

Report phải có:
- baseline SHA, final SHA, thời điểm
- Static Audit table: gate/result/evidence
- Tool Gates: lint/typecheck/build/emulator = PASS/FAIL/BLOCKED
- Runtime scenarios = PASS/FAIL/BLOCKED
- Security limitation
- final verdict.

Chỉ dùng:
- **ALL PASS** khi mọi required gate PASS.
- **PASS WITH EXPLICIT SECURITY LIMITATION** khi application/runtime verification PASS nhưng rules hardening là scope riêng.
- **BLOCKED** khi required gate không chạy được.
- **FAIL** khi có lỗi thực tế chưa sửa.

Không ghi “ALL GATES PASS” nếu còn FAIL/BLOCKED.

## 16. Git gate
Trước commit:
```bash
git status
git diff
```
Không commit secrets, local env, emulator junk, build cache hoặc unrelated changes.
Commit verification là:
`test: verify firebase migration gates`
hoặc message mô tả fix thực tế nếu có source fix.
Push `origin/main`.

## Definition of Done
Source audit + lint + typecheck + build + runtime/emulator nếu khả dụng + required scenarios + regression + truthful report + clean scoped commit/push. Không tuyên bố Firebase migration hoàn tất nếu chưa đạt các gate trên.
