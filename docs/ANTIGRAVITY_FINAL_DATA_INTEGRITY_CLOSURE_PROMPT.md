# ANTIGRAVITY FINAL DATA INTEGRITY CLOSURE PROMPT

## Mục tiêu
Đây là vòng CHỐT CUỐI cho data integrity của CRM nhỏ. Không redesign, không mở rộng scope, không Cloud Functions, không sửa UI.

Audit trực tiếp code hiện tại trên origin/main rồi sửa ngay những điểm cần thiết.

## 1. Giữ nguyên kiến trúc hiện tại
- Tiếp tục dùng `orders` làm business source of truth.
- `customers/{customerId}.orderSummaries` chỉ được gọi là transactional/materialized projection dùng để tính aggregate và serialize các mutation theo customer.
- Không thay kiến trúc sang subcollection mới.
- Không tự ý thêm backend/Cloud Functions.
- Không refactor lan sang UI.

## 2. Đóng race của repair utility
`syncCustomerAggregates(customerId)` hiện đang query orders rồi `updateDoc(customer)` ngoài transaction.

Sửa để utility không thể ghi đè một transaction order mutation mới hơn.

Ưu tiên phương án tối giản, phù hợp Firebase Web SDK hiện tại:
- đọc orders để dựng projection;
- dùng transaction đọc customer;
- chỉ ghi projection/aggregates khi customer vẫn ở trạng thái/version phù hợp;
- nếu phát hiện customer đã thay đổi trong lúc repair, retry/re-read thay vì overwrite.
Nếu cần thêm một field version nhỏ trên customer để optimistic concurrency thì được, nhưng không tạo kiến trúc mới.
Không làm utility phức tạp quá mức cho CRM nhỏ.

## 3. Không phá flow đang PASS
Giữ nguyên:
- createOrder(): transaction đọc customer + products, cập nhật order + customer projection atomically.
- updateOrderStatus(): transaction đọc order + customer, cập nhật order + customer projection atomically.
- collision-safe IDs.
- deterministic customer ID.
- existing validation.
- UI/service contracts.

## 4. Scalability
Không redesign `orderSummaries` cho hệ thống nhỏ này.
Chỉ:
- ghi nhận trong report rằng projection trên customer document có giới hạn Firestore document size;
- không gọi đây là blocker hiện tại;
- không tự ý thay schema.

## 5. Report terminology
Sửa report cho chính xác:
- `orders` = business source of truth.
- `customer.orderSummaries` = transactional/materialized projection.
- aggregates = derived fields from projection.
Không dùng wording nói orderSummaries là business source of truth tuyệt đối.

## 6. Verification
Chạy:
- npm run lint
- npx tsc --noEmit
- npm run build

Kiểm tra trực tiếp:
- create order concurrency vẫn atomic;
- update status concurrency vẫn atomic;
- repair utility không overwrite mutation mới hơn;
- no stale preflight query trong hai mutation chính;
- no fake timestamps;
- customer duplicate protection không regress.

Nếu emulator không có thì ghi BLOCKED, không cố giả PASS.

## 7. Report
Cập nhật `FIREBASE_FINAL_VERIFICATION_REPORT.md`:
- đúng SHA cuối cùng;
- chỉ claim PASS những gì thực sự kiểm chứng được;
- giữ explicit security limitation về Firestore rules;
- giữ emulator BLOCKED nếu môi trường thiếu firebase-tools/browser.

## 8. Commit/push
Chỉ cần 1 code commit + report sync nếu cần.
Ưu tiên:
`fix: close final data integrity gaps`

Push origin/main.
Cuối cùng báo:
- final SHA;
- lint/typecheck/build;
- data integrity verdict;
- remaining limitations.
