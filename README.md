# CRM Hoa ROVII

Ứng dụng web nội bộ quản lý đơn hoa và mini CRM cho Tiệm Hoa ROVII.

## Trạng thái hiện tại

Ứng dụng sử dụng **Next.js App Router + TypeScript** cho giao diện, **Firebase Authentication** cho đăng nhập và **Cloud Firestore** cho dữ liệu nghiệp vụ. Repository có Firestore Security Rules, Firestore indexes và bộ kiểm thử tích hợp dùng Firebase Emulator. Ảnh sản phẩm được nén trên trình duyệt và lưu dưới dạng Data URL trong Firestore; ứng dụng không sử dụng Firebase Storage.

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

- Các quy tắc Firestore hiện cho phép active member ghi trực tiếp tài liệu `orders`, `customers` và `products`. Điều này có nghĩa validation ở client/service chưa phải ranh giới bảo mật; xem [Source Audit 2026-10-16](docs/audits/CRM_HOA_ROVII_SOURCE_AUDIT_2026-10-16.md) trước khi đưa hệ thống vào production.
- Số điện thoại hợp lệ được chuẩn hóa về dạng quốc gia `0...`; tra cứu vẫn hỗ trợ hồ sơ cũ dạng `84...` để hạn chế trùng khách hàng.
- Cần phân trang danh sách khi dữ liệu tăng.
- Lưu Data URL trong Firestore chỉ phù hợp với catalog nhỏ và cần kiểm tra kích thước document.

## Tài liệu

- [Source audit & baseline risks](docs/audits/CRM_HOA_ROVII_SOURCE_AUDIT_2026-10-16.md)
- [MCP, Local Bridge & GitHub Actions plan](docs/automation/CRM_MCP_AND_GITHUB_ACTIONS_PLAN.md)
