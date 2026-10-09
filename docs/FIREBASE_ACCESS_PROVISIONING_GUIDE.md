# Hướng dẫn Thiết lập & Phân quyền Tài khoản Nhân sự (Role Provisioning)

Dự án **CRM-Hoa-ROVII** áp dụng mô hình bảo mật **Server-Trusted Workspace Membership**. Mọi quyền truy cập vào các collection nghiệp vụ (`orders`, `customers`, `products`, `settings`) đều được kiểm soát nghiêm ngặt thông qua tài liệu thành viên tại collection `users/{uid}` trên Cloud Firestore.

---

## 1. Nguyên tắc bảo mật cốt lõi

1. **Phân biệt rõ ràng giữa Auth User & Firestore Membership**:
   - **Firebase Authentication**: Chỉ có nhiệm vụ xác thực danh tính (Identity Verification: Email/Mật khẩu hoặc Google Sign-In / Số điện thoại).
   - **Firestore Membership (`users/{uid}`)**: Là nơi lưu trữ vai trò (`role`) và trạng thái kích hoạt (`status`).
2. **Quy tắc Least Privilege & Không tự cấp quyền (No Client Self-Promotion)**:
   - Client tuyệt đối **không có quyền tạo, sửa, xóa hoặc kích hoạt** tài liệu trong collection `users` (`allow write: if false;`).
   - Người dùng chỉ được phép đọc hồ sơ thành viên của chính mình (`allow get: if isAuthenticated() && request.auth.uid == userId;`).
   - Nghiêm cấm client duyệt danh sách nhân sự (`allow list: if false;`).
3. **Điều kiện truy cập hệ thống CRM**:
   - Tài khoản phải đăng nhập hợp lệ (`request.auth != null`).
   - Tài khoản phải tồn tại tài liệu tại `users/{uid}`.
   - Trạng thái thành viên phải là `status == "active"`.
   - Tài khoản `status == "inactive"` hoặc chưa được phân quyền sẽ bị từ chối truy cập (HTTP 403 / `permission-denied`).

---

## 2. Quy trình Cấp quyền (Provisioning Flow) dành cho Quản trị viên

Khi một nhân viên mới hoặc quản trị viên mới tham gia tiệm hoa:

### Bước 1: Tạo tài khoản xác thực (Authentication)
Vào **Firebase Console** -> **Authentication** -> Tab **Users** -> Nhấn **Add user**:
- Nhập **Email** (ví dụ: `nhanvien@cuatiemhoa.vn`) và **Password**.
- Nhấn **Add user**.
- Sao chép mã định danh duy nhất của tài khoản vừa tạo: **User UID** (ví dụ: `ab12cd34ef56gh78ij90`).

### Bước 2: Tạo hồ sơ phân quyền trên Cloud Firestore (Role Provisioning)
Vào **Firebase Console** -> **Firestore Database** -> Collection `users`:
- Nếu collection `users` chưa có, nhấn **Start collection** với tên `users`.
- Nhấn **Add document**:
  - **Document ID**: Dán chính xác **User UID** từ Bước 1 vào ô Document ID (Ví dụ: `ab12cd34ef56gh78ij90`).
  - Thêm các trường dữ liệu sau:
    - `role` (string): Nhập `"admin"` hoặc `"staff"`.
    - `status` (string): Nhập `"active"` (để cho phép làm việc) hoặc `"inactive"` (để tạm khóa tài khoản).
    - `email` (string): Nhập email nhân sự (ví dụ: `nhanvien@cuatiemhoa.vn`).
    - `createdAt` (string): Thời gian tạo (ISO string hoặc timestamp).
- Nhấn **Save**.

### Bước 3: Nhân viên đăng nhập và sử dụng hệ thống
- Nhân sự truy cập `/login` trên web CRM và đăng nhập bằng email/mật khẩu đã tạo.
- Hệ thống tự động xác nhận quyền `active` thông qua Firestore Security Rules và cho phép truy cập đầy đủ các chức năng quản lý đơn hàng, khách hàng, sản phẩm và cài đặt cửa hàng.

---

## 3. Khóa tài khoản nhân viên khi nghỉ việc hoặc tạm dừng

Khi một nhân sự nghỉ việc hoặc cần tạm ngưng quyền truy cập:
- Quản trị viên chỉ cần vào Firestore, tìm tài liệu `users/{uid}` của nhân viên đó.
- Đổi trường `status` từ `"active"` thành `"inactive"`.
- Ngay lập tức, mọi quyền đọc/ghi vào `orders`, `customers`, `products`, `settings` của tài khoản này sẽ bị Firestore Rules chặn triệt để mà không cần xóa tài khoản Firebase Auth.
