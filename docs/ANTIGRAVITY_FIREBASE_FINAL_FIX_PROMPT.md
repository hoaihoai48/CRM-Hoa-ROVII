# Antigravity — FINAL Firebase Migration Fix

Repo: hoaihoai48/CRM-Hoa-ROVII
Branch: main

Đây là vòng sửa cuối cho Firebase migration.

Audit code thực tế cho thấy migration hiện tại chưa đạt FINAL PASS dù FIREBASE_MIGRATION_AUDIT.md đang ghi ALL GATES PASS.

Không redesign UI. Không đổi route. Không thay service contract nếu không bắt buộc. Không tạo kiến trúc mới.

## 1. Atomic order + customer aggregate

Hiện tại createOrder đang set order rồi gọi syncCustomerAggregates; lỗi aggregate bị catch và order vẫn success. Đây là sai consistency.

Phải sửa để tạo order và cập nhật aggregate có consistency thực sự.
- Ưu tiên Firestore transaction.
- Transaction phải đọc customer/products trước writes.
- Đọc product thật từ Firestore, xác nhận tồn tại + active, lấy giá thật.
- Tính subtotal/total trong transaction.
- Tạo order và cập nhật customer aggregate trong cùng transaction.
- Nếu transaction fail thì không được tạo order một phần.
- Không console.error rồi trả success.

## 2. Atomic status transition + aggregate

updateOrderStatus hiện transaction chỉ update order/statusHistory, aggregate chạy sau transaction. Phải đưa aggregate update vào cùng transaction nếu phù hợp.

Transaction phải:
- đọc order
- validate canTransitionOrderStatus
- đọc customer và dữ liệu cần để tính aggregate
- update order
- append statusHistory
- update customer aggregate
- fail toàn bộ nếu bất kỳ phần nào fail.

## 3. Duplicate customer phone phải chống race condition

createCustomer hiện findCustomerByPhone rồi setDoc, có race condition.

Thiết kế lại để hai request đồng thời không thể tạo hai customer cùng phoneNormalized.
Ưu tiên deterministic document ID từ normalized phone hoặc transaction/unique-phone marker. Không phá references hiện tại.

## 4. Không fake current user

getCurrentUser hiện trả ANON-STAFF khi auth.currentUser null. Không được phép.

Trả trạng thái unauthenticated rõ ràng theo service contract; nếu cần sửa contract thì sửa tối thiểu. Không tạo fake staff identity.

## 5. Firebase config fail-fast đầy đủ

src/lib/firebase/config.ts hiện vẫn có fallback hard-code cho authDomain, projectId, storageBucket và các field khác.

Audit toàn bộ NEXT_PUBLIC_FIREBASE_*.
- Required fields phải có environment value.
- Không hard-code Firebase project identity.
- Thiếu required config phải fail rõ ràng.
- Giữ Firebase singleton.

## 6. Không swallow Firestore errors

Audit đặc biệt getStoreSettings, listCustomers, listOrders và mọi service khác.

Không catch mọi exception rồi trả dữ liệu giả/default như operation thành công.
Document không tồn tại có thể có default behavior có chủ đích; nhưng permission denied, network error, Firebase unavailable hoặc query error phải được throw rõ ràng.

## 7. Audit Firestore rules

Rules phải authenticated-only, không public.
Audit khả năng client tự sửa các protected fields như customer aggregates, order statusHistory, createdBy, snapshots, createdAt.
Siết rules nếu có thể mà không phá kiến trúc client Firebase hiện tại.
Nếu invariant không thể enforce hoàn toàn bằng rules mà không thêm backend, ghi rõ limitation; không tuyên bố security hoàn hảo.

## 8. Timestamp

Audit Timestamp/Date/ISO string → ISO string nhất quán.
Không để {seconds,nanoseconds} ra UI.
Không dùng Date.now làm cơ chế uniqueness nếu có giải pháp Firestore-safe tốt hơn.

## 9. Order calculation

Đảm bảo subtotal = sum(unitPrice * quantity), total = subtotal + deliveryFee - discount.
quantity > 0; deliveryFee >= 0; discount >= 0; discount <= subtotal.
Product phải tồn tại và active. Unit price lấy từ Firestore. Customer phải tồn tại. Snapshot phải lấy/kiểm chứng từ Firestore.

## 10. Aggregate semantics

Giữ đúng:
- totalOrders = số order có status != cancelled
- totalSpent = tổng total của order status == completed
- lastOrderDate = createdAt mới nhất của order status != cancelled

Test các transition hợp lệ và không hợp lệ. Không tự ý thay business rules trong canTransitionOrderStatus.

## 11. Dashboard

Audit toàn bộ dashboard.
- Không import mock.
- Không hard-code KPI demo.
- Data phải đi qua service.
- Không bypass service.

## 12. Mock dependency gate

grep toàn repo các chuỗi: @/lib/mock, mockCustomers, mockProducts, mockOrders, mockStoreSettings, mockCurrentUser.
Production runtime phải 0 dependency. Mock chỉ được phép ở seed/test/fixture/reference.

## 13. Auth/logout

Audit login, register, Google, phone OTP, AuthProvider, protected routes, Sidebar và Settings logout.
Logout phải signOut Firebase thật. Không dùng router.push('/login') để giả logout.
Sau logout auth state phải null và protected UI không được tiếp tục truy cập data.

## 14. Verification

Chạy:
- npm install
- npm run lint
- npx tsc --noEmit
- npm run build

Nếu có Firebase emulator/runtime phù hợp, test Customer create + duplicate phone race + read + find phone; Product create/read/deactivate; Order create/price/snapshot/statusHistory/aggregate/valid-invalid transition/rollback; Settings missing/existing/error; Auth login/protected/logout.

Nếu runtime không thể chạy vì environment, ghi BLOCKED chính xác. Không ghi PASS dựa trên source inspection.

## 15. Audit report

Cập nhật FIREBASE_MIGRATION_AUDIT.md. Mỗi mục phải PASS/FAIL/BLOCKED kèm evidence.
Không giữ câu ALL GATES PASS nếu runtime gate chưa thực sự được kiểm chứng.
Phải phản ánh transaction consistency, duplicate-phone atomicity, auth identity, Firebase config, error propagation, rules limitations và runtime verification.

## 16. FINAL GATE

Chỉ commit khi tất cả lỗi bắt buộc đã xử lý.
Không chấp nhận aggregate eventual update nhưng báo success; swallowed Firestore error; fake anonymous user; Firebase project fallback; duplicate phone race; mock runtime dependency; hoặc audit report PASS giả.

Không redesign UI, không đổi route, không đổi theme, không thêm framework/backend mới.

## 17. Commit

Nếu tất cả gate đạt:
Commit: fix: harden firestore transaction consistency
Push lên main.

Báo: commit SHA, files changed, transaction strategy, duplicate-phone strategy, auth/current-user strategy, Firebase config strategy, rules changes, tests actually executed, PASS/FAIL/BLOCKED và limitations.

Nguyên tắc cuối: source code thực tế là nguồn sự thật. Audit lại code sau khi sửa rồi mới cập nhật report.