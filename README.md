# CRM Hoa ROVII

Ứng dụng web nội bộ quản lý đơn hoa và mini CRM cho Tiệm Hoa ROVII.

## Trạng thái hiện tại

Ứng dụng sử dụng **Next.js App Router + TypeScript** cho giao diện, **Firebase Authentication** cho đăng nhập và **Cloud Firestore** cho dữ liệu nghiệp vụ. Repository có Firestore/Storage Security Rules, Firestore indexes và bộ kiểm thử tích hợp dùng Firebase Emulator.

## Phạm vi V1

- Dashboard
- Quản lý đơn hàng: tạo, xem, sửa theo trạng thái cho phép và chuyển trạng thái theo state machine
- Quản lý khách hàng và lịch sử mua
- Quản lý sản phẩm
- Quản lý tài khoản nhân viên (admin)
- Nút liên hệ Zalo trực tiếp
- Cài đặt thông tin cửa hàng và logo

Không bao gồm storefront công khai, tài khoản khách hàng, giỏ hàng/checkout, thanh toán, tồn kho, nhà cung cấp hoặc API Zalo.

## Trạng thái đơn hàng

- Mới → Đã xác nhận → Đang giao → Hoàn tất
- Mới → Đã hủy
- Đã xác nhận → Đã hủy

Không cho phép chuyển trạng thái tùy ý. Đơn đang giao, hoàn tất hoặc đã hủy không được sửa nội dung theo luồng hiện tại.

## Routes

- `/login`
- `/dashboard`
- `/orders`, `/orders/new`, `/orders/[id]`
- `/customers`, `/customers/[id]`
- `/products`, `/products/new`, `/products/[id]`
- `/staff` (admin)
- `/settings`

## Yêu cầu

- Node.js 24 (CI target; installed Firebase packages require Node >=24.12.0)
- Java 21 trở lên để chạy Firebase Emulator tests
- Firebase project/configuration cho chạy với môi trường thật

## Chạy local

```bash
npm ci
npm run dev
```

Khi chạy với Firebase thật, cấu hình các biến môi trường phù hợp trong file `.env.local` hoặc môi trường triển khai:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (khi dùng Storage)
- `NEXT_PUBLIC_FIREBASE_STORAGE_ENABLED=true` (chỉ khi Storage đã được cấu hình)

Không commit file `.env.local`, credentials hoặc secrets.

## Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm run build
npm run test:emulator
```

`npm run test:emulator` khởi chạy Firebase Auth và Firestore Emulator. Bộ test tạo dữ liệu kiểm thử trong emulator, không dùng dữ liệu production. GitHub Actions chạy các bước này trên runner sạch cho pull request và push vào `main`.

## Giới hạn đã biết

- Firestore Rules yêu cầu active membership để đọc/ghi dữ liệu nghiệp vụ; quyền ghi sản phẩm chỉ dành cho admin. Với mô hình Firebase Spark, order/customer transactions vẫn chạy từ client, vì vậy Rules không thể tự chứng minh mọi phép tính tổng tiền hoặc customer aggregate. F-01 là giới hạn trust-boundary đã được chấp nhận cho CRM nội bộ; xem [Firebase Security Audit](docs/audits/CRM_HOA_ROVII_FIREBASE_SECURITY_AUDIT_2026-11-22.md) và [Spark write-boundary decision](docs/security/FIRESTORE_BUSINESS_WRITE_BOUNDARY_PLAN.md).
- Số điện thoại hợp lệ được chuẩn hóa về dạng quốc gia `0...`; tra cứu vẫn hỗ trợ hồ sơ cũ dạng `84...` để hạn chế trùng khách hàng. Khi tạo đơn, ID khách hàng được kiểm tra khớp với số điện thoại trong cùng Firestore transaction.
- Dashboard chỉ đọc tối đa 200 đơn mới nhất trong ngày và hiển thị cảnh báo khi vượt ngưỡng; trong trường hợp đó, số lượng đơn và doanh thu trên KPI được tính trên 200 đơn này. Danh sách đơn gần đây giới hạn 6 đơn mới nhất.
- Danh sách đơn hàng và khách hàng hỗ trợ cursor pagination khi duyệt thông thường. Tìm kiếm chuỗi con hiện vẫn tải toàn bộ tập dữ liệu; danh mục sản phẩm và gợi ý khách hàng trên form tạo đơn cũng tải toàn bộ collection. Cách này phù hợp với quy mô CRM nội bộ nhỏ; nếu dữ liệu tăng đáng kể, cần bổ sung tìm kiếm/phân trang có index.
- Data URL lưu trong Firestore được giới hạn kích thước và số ảnh ở service lẫn Firestore Rules; phù hợp với catalog nhỏ. Firebase Storage chỉ dùng khi project đã được cấu hình tương ứng.

## Tài liệu

- [Source audit & baseline risks](docs/audits/CRM_HOA_ROVII_SOURCE_AUDIT_2026-10-16.md)
- [MCP, Local Bridge & GitHub Actions plan](docs/automation/CRM_MCP_AND_GITHUB_ACTIONS_PLAN.md)
