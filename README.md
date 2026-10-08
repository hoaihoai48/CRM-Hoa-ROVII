# CRM Hoa ROVII

Ứng dụng web nội bộ quản lý đơn hoa và mini CRM cho cửa hàng.

## Phase 1 — UI Scaffold

- Next.js App Router + TypeScript
- Tailwind CSS + Lucide
- Responsive/mobile-first
- Mock data, chưa kết nối Firebase
- Sẵn sàng chuyển sang Firebase Auth + Firestore + Storage ở Phase 2

## Phạm vi V1

- Dashboard
- Quản lý đơn hàng
- Tạo và xem chi tiết đơn
- Quản lý khách hàng và lịch sử mua
- Quản lý sản phẩm
- Nút liên hệ Zalo trực tiếp
- Cài đặt thông tin cửa hàng

Không bao gồm storefront công khai, tài khoản khách hàng, giỏ hàng/checkout, thanh toán, tồn kho, nhà cung cấp hoặc API Zalo.

## Trạng thái đơn

- Mới → Đã xác nhận → Đang giao → Hoàn tất
- Mới → Đã hủy
- Đã xác nhận → Đã hủy

Không cho phép chuyển trạng thái tùy ý.

## Routes

- /login
- /dashboard
- /orders
- /orders/new
- /orders/[id]
- /customers
- /customers/[id]
- /products
- /products/new
- /products/[id]
- /settings

## Chạy local

```bash
npm install
npm run dev
```

## Phase 2

Kết nối Firebase Auth, Firestore và Storage; thay mock service bằng service thật mà không đổi cấu trúc màn hình.
