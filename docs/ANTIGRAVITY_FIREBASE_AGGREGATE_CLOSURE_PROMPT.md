# Antigravity — Final Aggregate Invariant & Verification Closure

## Mục tiêu

Đây là vòng **hardening cuối**, chỉ xử lý đúng hai nhóm vấn đề:

1. **Customer aggregate invariant** trong `createOrder()` và `updateOrderStatus()`.
2. **Verification report provenance/runtime truthfulness**.

Không thêm feature. Không redesign UI. Không migration sang Cloud Functions. Không thay đổi schema ngoài mức cần thiết để sửa invariant.

---

## 1. Baseline

Đọc trạng thái mới nhất của `origin/main`, đặc biệt:

- `src/lib/services/orders.ts`
- `src/lib/services/customers.ts`
- `FIREBASE_FINAL_VERIFICATION_REPORT.md`
- `firestore.rules`
- `firestore.indexes.json`

Ghi chính xác baseline SHA trước khi sửa.

Không tin SHA trong report cũ nếu git history cho thấy khác.

---

# 2. Customer aggregate — SOURCE OF TRUTH

Phải đảm bảo invariant thực tế:

### totalOrders

```
count(order where customerId == customerId
      and status != "cancelled")
```

### totalSpent

```
sum(order.summary.total
    where customerId == customerId
    and status == "completed")
```

### lastOrderDate

```
max(order.createdAt
    where customerId == customerId
    and status != "cancelled")
```

Nếu không có active order:

``lastOrderDate = ""``

**Không được coi aggregate fields hiện tại trên customer document là source of truth.**

---

# 3. createOrder()

Audit và sửa `createOrder()`.

Không dùng:

``currentTotalOrders + 1``

làm source of truth.

Trong cùng Firestore transaction:

1. read customer.
2. read all required products.
3. read existing orders của customer.
4. validate customer/products.
5. calculate new order.
6. project new order vào danh sách orders.
7. recompute:
   - totalOrders
   - totalSpent
   - lastOrderDate
8. write order.
9. write customer aggregate.

Tất cả reads phải hoàn tất trước writes.

Lưu ý: Firestore transaction query phải tuân thủ SDK transaction semantics hiện tại. Nếu `tx.get(query)` được hỗ trợ bởi version đang dùng thì dùng đúng API; nếu không, dùng API transaction-compatible tương ứng. **Không quay lại query ngoài transaction rồi mới write.**

Order mới có status `new`, vì vậy:
- được tính vào totalOrders
- chưa được tính vào totalSpent
- được tính vào lastOrderDate.

---

# 4. updateOrderStatus()

Không dùng delta dựa trên:

- `customer.totalOrders`
- `customer.totalSpent`

làm source of truth.

Trong cùng transaction:

1. read order.
2. read customer.
3. read tất cả orders của customer.
4. project order với status mới.
5. recompute cả 3 aggregate từ projected orders.
6. write order + history.
7. write customer aggregate.

Các invariant phải đúng cho mọi transition hợp lệ:

- new → confirmed
- confirmed → delivering
- delivering → completed
- new → cancelled
- confirmed → cancelled

Nếu order chuyển completed → cancelled không được phép theo state machine thì giữ nguyên rule hiện tại.

---

# 5. Preserve atomicity

Nếu bất kỳ read/validation/calculation/write nào fail:

- không tạo order nửa chừng;
- không đổi status nửa chừng;
- không đổi aggregate nửa chừng.

Không swallow exception.

---

# 6. Repair utility

`syncCustomerAggregates()` có thể tiếp tục tồn tại như utility sửa dữ liệu legacy.

Nhưng phải:

- document rõ đây là repair utility;
- không được dùng nó như workaround cho normal create/update flow;
- normal flow phải tự duy trì invariant atomically.

Nếu có thể làm utility an toàn hơn mà không mở rộng scope, có thể cải thiện; không cần redesign.

---

# 7. Regression

Sau khi sửa aggregate:

Kiểm tra các trường hợp:

### Case A
Không có order trước → create order.

Expected:
- totalOrders = 1
- totalSpent = 0
- lastOrderDate = order.createdAt

### Case B
Có 2 active orders + 1 cancelled order → create order.

Expected:
- totalOrders = 3
- không tính cancelled.

### Case C
Có completed order → create order mới.

Expected:
- totalSpent chỉ gồm completed orders.

### Case D
new → confirmed

Expected aggregate không đổi về số lượng/chi tiêu.

### Case E
confirmed → delivering

Expected aggregate không đổi.

### Case F
delivering → completed

Expected:
- totalSpent tăng đúng order total.

### Case G
new → cancelled

Expected:
- totalOrders không tăng cho order cancelled.

### Case H
Dữ liệu aggregate customer ban đầu sai nhưng orders đúng.

Expected:
- create/update flow sửa aggregate về đúng source-of-truth.

Đây là case bắt buộc để chứng minh không còn phụ thuộc aggregate cũ.

---

# 8. Runtime verification

Kiểm tra xem Firebase Emulator có thể được bật/fix cấu hình an toàn hay không.

Nếu có thể:

- chạy emulator;
- seed dữ liệu test;
- chạy các case A–H;
- test duplicate customer;
- test invalid product/customer;
- test illegal transition;
- test unauthenticated permission.

Không dùng production destructive test.

Nếu emulator thực sự không thể chạy:

**BLOCKED**, ghi chính xác nguyên nhân.

Không biến source inspection thành runtime PASS.

---

# 9. Tool gates

Sau code changes chạy lại:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Nếu có test/emulator script phù hợp thì chạy luôn.

Không disable lint/typecheck.

---

# 10. Verification report provenance

Cập nhật:

`FIREBASE_FINAL_VERIFICATION_REPORT.md`

Phải ghi:

### Baseline
SHA thực tế của commit ngay trước hardening.

### Changes
Commit(s) thực tế chứa source fixes.

### Final
SHA thực tế của commit cuối cùng sau report.

Không được lấy SHA từ report cũ.

Sau khi commit report, chạy:

```bash
git rev-parse HEAD
git log -n 5 --oneline
```

và đối chiếu report với git history.

Nếu report được commit trong cùng commit với source fix thì ghi đúng SHA đó.

---

# 11. Security limitation

Giữ nguyên đánh giá nếu rules vẫn:

```
allow read, write: if request.auth != null;
```

Ghi rõ:

**Application transaction integrity: PASS**

nhưng:

**Direct client Firestore write hardening: NOT COMPLETE / SEPARATE SECURITY SCOPE**

Không tự mở rộng quyền.

---

# 12. Final verdict

Chỉ dùng:

### ALL PASS
Nếu tất cả required static/tool/runtime gates PASS và security limitation không được coi là required gate.

### PASS WITH EXPLICIT SECURITY LIMITATION
Nếu application correctness PASS nhưng Firestore rules vẫn authenticated-only rộng.

### BLOCKED
Nếu required runtime verification không thể chạy.

### FAIL
Nếu còn lỗi aggregate/integrity thực tế.

Không được ghi ALL PASS nếu runtime bắt buộc vẫn BLOCKED.

---

# 13. Final git gate

Kiểm tra:

```bash
git status
git diff
git log -n 5 --oneline
```

Không commit unrelated changes.

Commit message ưu tiên:

`fix: enforce customer aggregate invariants`

Nếu source đã sửa và report cập nhật trong cùng vòng, có thể dùng message mô tả đầy đủ nhưng phải phản ánh nội dung thực tế.

Push lên `origin/main`.

## Definition of Done

- aggregate không còn phụ thuộc customer aggregate cũ;
- create/update recompute từ orders trong transaction;
- A–H regression cases verified;
- lint PASS;
- typecheck PASS;
- build PASS;
- runtime/emulator PASS hoặc BLOCKED với evidence;
- report SHA chính xác;
- security limitation trung thực;
- git clean;
- push thành công.
