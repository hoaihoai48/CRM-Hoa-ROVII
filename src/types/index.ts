// Types for Mini Order Management (Tiệm Hoa)
// Compatible with planned Firebase Firestore model:
// users/{userId}
// customers/{customerId}
// products/{productId}
// orders/{orderId}
// orders/{orderId}/items/{itemId}
// orders/{orderId}/statusHistory/{historyId}
// settings/store

export type OrderStatus = 'new' | 'confirmed' | 'delivering' | 'completed' | 'cancelled';
export type UserRole = 'admin' | 'staff';
export type MembershipStatus = 'active' | 'inactive';

export interface UserMembership {
  uid: string;
  email: string;
  role: UserRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  status?: MembershipStatus;
}

export interface CustomerOrderSummary {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  orderSummaries?: CustomerOrderSummary[];
  note?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  unit: string; // e.g. "bó", "giỏ", "cành", "lẵng", "hộp"
  isActive: boolean;
  category?: string;
  imageUrl?: string;
  /** Additional images (max 5 total). imageUrl stays as the cover for compatibility. */
  imageUrls?: string[];
  note?: string;
  createdAt: string;
}

export interface CustomerSnapshot {
  name: string;
  phone: string;
  address: string;
}

export interface ProductSnapshot {
  name: string;
  unit: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productSnapshot: ProductSnapshot;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderStatusHistory {
  id: string;
  status: OrderStatus;
  timestamp: string;
  note?: string | null;
  actorName: string;
}

export interface OrderSummary {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
}

export interface Order {
  id: string; // e.g. "DH-1024"
  customerId: string;
  customerSnapshot: CustomerSnapshot;
  items: OrderItem[];
  summary: OrderSummary;
  status: OrderStatus;
  statusHistory: OrderStatusHistory[];
  note?: string;
  createdAt: string;
  createdBy: string;
  deliveryDate?: string;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  address: string;
  note?: string;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerId: string;
  customerSnapshot: CustomerSnapshot;
  items: CreateOrderItemInput[];
  deliveryFee: number;
  discount: number;
  note?: string;
  deliveryDate?: string;
  createdBy: string;
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  actorName: string;
  note?: string;
}

export interface CreateProductInput {
  name: string;
  price: number;
  unit: string;
  isActive?: boolean;
  category?: string;
  imageUrl?: string;
  imageUrls?: string[];
  note?: string;
}

export interface UpdateStoreSettingsInput {
  storeName?: string;
  phone?: string;
  address?: string;
  zaloUrl?: string;
  email?: string;
  notificationEnabled?: boolean;
}

export interface StoreSettings {
  storeName: string;
  phone: string;
  address: string;
  zaloUrl: string;
  email: string;
  notificationEnabled?: boolean;
}
