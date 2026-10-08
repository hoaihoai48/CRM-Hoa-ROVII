# Antigravity Prompt — Firebase Data Migration

Repo: hoaihoai48/CRM-Hoa-ROVII
Branch: main

## Mục tiêu

Chuyển CRM từ:

UI → services → mock

sang:

UI → services → Firebase Firestore

Giữ nguyên service contract và UI. Không redesign.

## Audit trước khi sửa

Đọc toàn bộ:

- src/types/index.ts
- src/lib/services/*
- src/lib/mock/*
- src/lib/firebase/*
- src/components/auth/*
- firestore.rules
- firebase.json
- toàn bộ 11 route CRM, đặc biệt customers, orders, orders/new, orders/[id], products, settings, dashboard, login.

Lập dependency map route → service → data source. Tìm mọi runtime dependency vào mock.

## Firebase config

Audit src/lib/firebase/config.ts.

- Dùng NEXT_PUBLIC_FIREBASE_*.
- Loại bỏ dummy/fake Firebase config fallback.
- Thiếu biến bắt buộc phải fail rõ ràng.
- Không hard-code secret.
- Giữ singleton bằng getApps()/initializeApp().

## Giữ service contract

Giữ các API hiện tại:

Customers:
- listCustomers()
- getCustomerById()
- findCustomerByPhone()
- createCustomer()

Products:
- listProducts()
- getProductById()
- listActiveProducts()
- createProduct()
- updateProduct()

Orders:
- listOrders()
- getOrderById()
- createOrder()
- updateOrderStatus()

Settings:
- getStoreSettings()
- updateStoreSettings()
- getCurrentUser()

Routes không import trực tiếp Firestore; chỉ services được truy cập Firestore.

## Firestore schema

Dùng:

- customers/{customerId}
- products/{productId}
- orders/{orderId}
- orders/{orderId}/statusHistory/{historyId} nếu chọn subcollection
- settings/store

Giữ domain model hiện tại.

Order phải giữ customerId, customerSnapshot, items[], summary, status, statusHistory, note, createdAt, createdBy, deliveryDate.

Không để Firebase Timestamp chảy trực tiếp ra UI; map về ISO string.

## Customers

Chuyển hoàn toàn sang Firestore.

- listCustomers → getDocs(collection(db, 'customers'))
- getCustomerById → getDoc()
- findCustomerByPhone → query phoneNormalized == normalizedPhone
- createCustomer → kiểm tra duplicate phone trước khi tạo.

Không scan toàn bộ customer để tìm phone nếu có thể query trực tiếp.

## Products

Chuyển hoàn toàn sang Firestore.

- list/get → Firestore
- active products → query isActive == true
- create/update → Firestore

Giữ validation hiện tại. Product inactive không được dùng để tạo order.

## Orders

Đây là phần quan trọng nhất.

createOrder phải:

1. validate customerId
2. validate customerSnapshot
3. validate items
4. đọc product thật từ Firestore
5. xác nhận product tồn tại + active
6. lấy price từ Firestore, không tin price từ client
7. tính subtotal
8. validate deliveryFee/discount
9. tạo product snapshot
10. tạo customer snapshot
11. tạo order
12. cập nhật customer aggregate atomic

OrderItem giữ productId, productSnapshot.name, productSnapshot.unit, quantity, unitPrice, subtotal.

Không để client tự quyết định unitPrice.

## Order status history

Create order phải có status new và history tương ứng.

updateOrderStatus phải:

- đọc order hiện tại
- validate bằng canTransitionOrderStatus()
- update status
- append history
- giữ actorName/note/timestamp

Ưu tiên Firestore transaction hoặc atomic write để tránh race condition.

## Customer aggregates

Giữ đúng semantics:

- totalOrders = số order không cancelled
- totalSpent = tổng total của completed orders
- lastOrderDate = createdAt mới nhất của non-cancelled order

Khi create order hoặc status thay đổi làm aggregate thay đổi, cập nhật customer aggregate bằng transaction/batch.

## Settings

src/lib/services/settings.ts dùng settings/store:

- get → getDoc
- update → setDoc/updateDoc với merge

Không tiếp tục dùng mock.

## Current user

getCurrentUser() không dùng mockCurrentUser.

Map Firebase Auth user → domain User, tối thiểu uid/displayName/email/photoURL.

Không tự giả mạo admin. Nếu role chưa có hệ thống thật, dùng default role rõ ràng và không coi đó là authorization thực sự.

## Logout

src/app/settings/page.tsx hiện không được dùng router.push('/login') như mock logout.

Phải gọi Firebase signOut() thông qua auth/service phù hợp, sau đó redirect về login.

## Auth guard

Audit toàn bộ protected routes:

- dashboard
- customers
- orders
- products
- settings

Không redirect loop. Không đọc Firestore như user chưa đăng nhập rồi mới redirect.

Giữ /login hoạt động.

## Firestore rules

Audit và sửa firestore.rules.

- Không public write.
- CRM data tối thiểu phải authenticated.
- settings phải authenticated.
- products không mặc định public nếu không có public storefront.
- Nếu khả thi, hạn chế client sửa protected fields/aggregate mà không phá MVP.

## Indexes

Audit mọi Firestore query.

Nếu cần composite index thì cập nhật firestore.indexes.json và config liên quan. Không tạo index thừa.

## Seed

Không auto-seed khi app chạy.

Tạo script seed riêng, ví dụ scripts/seed-firestore.ts.

Yêu cầu:

- idempotent
- không duplicate
- giữ document IDs hiện tại nếu phù hợp
- seed customers trước
- seed products
- seed orders
- seed status history
- seed settings/store

Production services không import mock.

## Error handling

Service phải throw lỗi rõ ràng, không nuốt lỗi.

Đặc biệt:
- createCustomer
- createProduct
- createOrder
- updateOrderStatus
- updateStoreSettings

Không báo success giả khi Firebase operation fail.

## Timestamp normalization

Tạo helper nếu cần để Firestore Timestamp / Date / string → ISO string.

Áp dụng cho:
- createdAt
- lastOrderDate
- deliveryDate
- statusHistory.timestamp

Không để {seconds, nanoseconds} xuất hiện ở UI.

## Không redesign UI

Không đổi route, visual design, Light/Dark mode, component architecture.

Chỉ sửa UI nếu migration làm lộ bug thực sự.

## Mock dependency gate

Sau migration grep toàn repo:

- @/lib/mock
- mockCustomers
- mockProducts
- mockOrders
- mockStoreSettings
- mockCurrentUser

Production UI/services phải có 0 runtime dependency vào mock.

Mock chỉ được phép ở seed/test/fixture/reference.

## Data lineage audit

Phải chứng minh:

- Customer UI → customers service → Firestore
- Product UI → products service → Firestore
- Order UI → orders service → Firestore
- Dashboard → services → Firestore
- Settings UI → settings service → Firestore

Không route nào âm thầm dùng mock.

## Verification

Chạy nếu môi trường cho phép:

- npm install
- npm run lint
- npx tsc --noEmit
- npm run build

Nếu có Firebase Emulator thì test:

Customer: create → read → find phone → aggregate
Product: create → read → deactivate
Order: create → read → status transition
Settings: read → update
Auth: login → protected route → logout

Không tuyên bố PASS nếu command thực tế fail.

Nếu thiếu Firebase environment, ghi BLOCKED vì environment.

## Final audit report

Tạo FIREBASE_MIGRATION_AUDIT.md gồm:

1. Firebase config
2. Auth
3. Auth guard
4. Customers
5. Products
6. Orders
7. Order status history
8. Customer aggregates
9. Settings
10. Firestore rules
11. Indexes
12. Seed
13. Mock dependency scan
14. TypeScript
15. ESLint
16. Build
17. Runtime/emulator test

Mỗi mục PASS / FAIL / BLOCKED kèm evidence.

## FINAL GATE

Không commit nếu:

- production service còn dùng mock
- settings logout còn mock
- config còn dummy credentials
- order snapshot sai
- statusHistory mất
- customer aggregate mất
- rules mở public write
- TypeScript fail
- lint fail
- build fail vì lỗi code

Nếu tất cả gate đạt:

Commit một lần:

feat: migrate crm data services to firestore

Push lên main.

Sau đó báo commit SHA, files changed, Firestore schema, rules, seed, tests executed và PASS/FAIL/BLOCKED.

Không redesign UI trong task này.
