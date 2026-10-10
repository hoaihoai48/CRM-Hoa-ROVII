# CRM Hoa ROVII — CRUD / Navigation / Role-Permission Audit

- **HEAD ban đầu:** `5eb299b` (`fix(orders): show product thumbnails and center search icon`)
- **Phạm vi:** toàn bộ route `src/app`, services `src/lib/services`, types, AuthProvider/AppShell, `firestore.rules`
- **Nguyên tắc:** sửa theo nguyên nhân gốc từ code thực tế; không refactor ngoài phạm vi.

## 1. Ma trận route → action → service → Firestore → permission (cuối cùng)

| Route | UI action | Service | Firestore op | Quyền |
|---|---|---|---|---|
| `/dashboard` | Xem tổng quan, link tạo/xem đơn, khách, sản phẩm | `listOrders`, `getStoreSettings` | read `orders`, `settings/store` | active staff/admin |
| `/orders` | List, search, lọc status, link chi tiết | `listOrders` | read `orders` | active staff/admin |
| `/orders/new` | Tạo đơn (prefill `?customerId=`) | `findCustomerByPhone`, `createCustomer`, `createOrder` (transaction) | read/write `customers`, `products`, `orders` | active staff/admin |
| `/orders/[id]` | Xem chi tiết, chuyển trạng thái hợp lệ, **sửa đơn (new/confirmed)** | `getOrderById`, `updateOrderStatus`, **`updateOrder`** (transaction) | read/write `orders` + `customers` | active staff/admin |
| `/customers` | List, search, tạo inline, link Sửa/Chi tiết | `createCustomer`, `listCustomers` | read/write `customers` | active staff/admin |
| `/customers/[id]` | Xem hồ sơ, **sửa tên/địa chỉ/ghi chú**, tạo đơn prefill | `getCustomerById`, `listOrdersByCustomer`, **`updateCustomer`** | read/write `customers`, read `orders` | active staff/admin |
| `/products`, `/products/new`, `/products/[id]` | List, tạo (validation), sửa, ngừng bán (mềm) | `createProduct`, `updateProduct`, `listProducts` | read/write `products` | active staff/admin |
| `/settings` | Staff xem; **admin sửa/lưu** | `getStoreSettings`, `updateStoreSettings` | read: active member; write: **admin only (rules)** | xem: staff/admin; ghi: admin |
| `/users/{uid}` | Không có UI quản trị | — | get-self only; no list/write | khóa client tự nâng role |

Đối chiếu Rules (`firestore.rules`): `isActiveMember()` cho đọc/ghi `orders/customers/products`; `settings/*` ghi chỉ `isAdmin()`; `users/*` cấm ghi từ client. Frontend và Rules nhất quán — **không đổi Rules** (đã đúng phạm vi tối thiểu).

## 2. Lỗi phát hiện, nguyên nhân gốc, cách xử lý

| # | Lỗi | Nguyên nhân gốc | File | Xử lý |
|---|---|---|---|---|
| 1 | Không sửa được khách hàng (không có UI + không có service) | Thiếu `updateCustomer`; `customers/[id]` chỉ đọc | `src/lib/services/customers.ts`, `src/app/customers/[id]/page.tsx` | **Thêm `updateCustomer` (chỉ name/address/note; SĐT là identity trong doc ID nên bất biến; stats do transaction đơn hàng tính)** + form Sửa/Lưu/Hủy đầy đủ |
| 2 | Không sửa được đơn hàng | Không có route/service edit; chi tiết chỉ đổi status | `src/lib/services/orders.ts`, `src/app/orders/[id]/page.tsx` | **Thêm `updateOrder`**: chỉ `new`/`confirmed`; giá đọc lại từ `products` (client totals bị bỏ qua); tổng + aggregates recompute trong cùng transaction; UI form sửa + nút "Sửa đơn hàng" |
| 3 | Nút "Tạo đơn hoa cho khách này" mất context (phải nhập lại SĐT) | Link cứng `/orders/new` không truyền khách | `customers/[id]`, `orders/new` | Link `?customerId=` + prefill (có Suspense boundary cho `useSearchParams`) |
| 4 | Bấm chuyển trạng thái sai / thiếu user không phản hồi | `if (!canTransition…) return;` và `if (!currentUser) return;` silent | `orders/[id]` | Hiển thị message lỗi cụ thể; disable nút khi đang cập nhật (chống double-submit) |
| 5 | Trang chi tiết (đơn/khách) lỗi tải không có retry | Chỉ render text đỏ | `orders/[id]`, `customers/[id]` | Thêm nút "Thử tải lại" + "Quay lại danh sách" |
| 6 | Tạo sản phẩm lọt `price` rỗng/âm/`NaN→0` | `price: Number(price) \|\| 0`, không validation client | `products/new` | Validate tên/giá/đơn vị trước submit; giữ dữ liệu form khi lưu thất bại |
| 7 | Empty-state khách hàng không có action | `EmptyState` không truyền `action` | `customers/page` | Thêm nút "Thêm khách hàng"; thêm link "Sửa" ở bảng desktop |
| 8 | Hint còn chữ "(Placeholder)" | Text sót | `settings/page` | Xóa chữ sót |
| 9 | `phoneSearch >= 8 ký tự` yếu hơn chuẩn VN | Check độ dài thay vì regex VN | `orders/new` (đã stage từ trước) | Giữ fix staged: dùng `isValidVNPhone` |
| 10 | Link Zalo sai với SĐT `84…` | Không chuẩn hóa `84→0` | `ZaloButton` (đã stage từ trước) | Giữ fix staged: `normalizeZaloPhone` |

**Giữ nguyên có chủ ý:** đơn `delivering/completed/cancelled` bất biến (toàn vẹn lịch sử/tài chính); không xóa cứng sản phẩm đã dùng trong đơn (ngừng bán mềm); không xây module quản trị tài khoản; không thêm nghiệp vụ thanh toán/tồn kho.

**Rủi ro tồn dư (ghi nhận, ngoài phạm vi an toàn của đợt này):** Rules cho active member `write` toàn bộ doc `customers/orders` nên client trực tiếp vẫn có thể ghi đè stats — service/UI mới không có đường nào làm vậy; siết field-level trong Rules cần kiểm thử emulator (môi trường hiện tại thiếu JDK 21).

## 3. Ma trận quyền cuối cùng

- `staff` active: CRUD khách/sản phẩm/đơn theo luồng trên; chuyển trạng thái theo state machine; sửa đơn `new/confirmed`; xem settings + dashboard.
- `admin` active: mọi quyền staff + ghi settings.
- `inactive`/không membership/chưa login: bị chặn ở `AppShell` (fail-closed) và ở Rules; trang login giữ nguyên.
- Không ai tự đổi role/status qua client (`users/*` deny write).

## 4. Kết quả kiểm thử

| Nhóm | Kết quả | Bằng chứng |
|---|---|---|
| Type check (`npx tsc --noEmit`) | **PASS** | exit 0 |
| Lint (`npm run lint`) | **PASS** | exit 0 |
| Production build (`npm run build`) | **PASS** | 15/15 routes, không lỗi |
| Emulator suite (`npm run test:emulator`, gồm CASE K/L mới cho updateCustomer/updateOrder) | **BLOCKED** | `firebase-tools` yêu cầu JDK 21+, máy chỉ có JDK 17 (`java -version`: 17.0.18). CASE K/L đã được typecheck cùng suite; cần chạy trên máy/CI có JDK 21 |
| Điều hướng (sidebar/mobile/back/breadcrumb/prefill) | **PASS (code)** | review code, chưa chạy browser (không có test account/browser env) |
| Regression luồng cũ | **PASS (code+build)** | không đổi logic tạo đơn/status/aggregates; diff tập trung |

## 5. Chức năng đã xác minh vs chưa

- Xác minh bằng chạy thực tế: typecheck, lint, build.
- Mới chỉ xác minh bằng code/test tĩnh: toàn bộ luồng CRUD mới (cần emulator JDK 21 + browser QA với tài khoản test).

## 6. Thay đổi chính (diff)

- `src/types/index.ts`: `UpdateCustomerInput`, `UpdateOrderInput`.
- `src/lib/services/customers.ts`: `updateCustomer` (allowlist, giữ staged `isValidVNPhone`).
- `src/lib/services/orders.ts`: `updateOrder` (transaction, server-price-wins, recompute aggregates, immutable sau confirmed).
- `src/app/customers/[id]/page.tsx`: form sửa + retry + link prefill.
- `src/app/customers/page.tsx`: empty-state action + link Sửa.
- `src/app/orders/[id]/page.tsx`: form sửa đơn + message lỗi + retry + chống double-submit.
- `src/app/orders/new/page.tsx`: prefill `?customerId` + Suspense (giữ staged `isValidVNPhone`).
- `src/app/products/new/page.tsx`: validation client.
- `src/app/settings/page.tsx`: xóa "(Placeholder)".
- `scripts/test-emulator-integrity.ts`: CASE K (customer update) + CASE L (order edit + immutability).
