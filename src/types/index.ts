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
  /** Internal Rules linkage for the most recent active order; not editable in the customer UI. */
  lastOrderDateOrderId?: string | null;
  /** Internal Rules linkage for the order written in the current transaction. */
  lastOrderMutationOrderId?: string;
  /** Unique final status-history entry ID for the current order mutation. */
  lastOrderMutationId?: string;
  /** Canonical order ID temporarily added while refilling the bounded active projection. */
  lastOrderRefillOrderId?: string | null;
  /** Bounded active-only recent-order projection (max 20); cancelled orders remain canonical in orders. */
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
  /** Stable Firebase Auth UID; optional for legacy history entries. */
  actorUid?: string;
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
  /** Stable Firebase Auth UID; optional for legacy orders. */
  createdByUid?: string;
  deliveryDate?: string;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  address: string;
  note?: string;
}

/** Editable customer fields. Phone is the identity key (part of doc ID) and stats are system-computed — neither is editable here. */
export interface UpdateCustomerInput {
  name: string;
  address: string;
  note?: string;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  /** Existing customer ID. Omit for a new customer created atomically with the order. */
  customerId?: string;
  customerSnapshot: CustomerSnapshot;
  items: CreateOrderItemInput[];
  deliveryFee: number;
  discount: number;
  note?: string;
  deliveryDate?: string;
  createdBy: string;
  createdByUid?: string;
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  actorName: string;
  actorUid?: string;
  note?: string;
}

/** Editable order fields. Only orders with status 'new' or 'confirmed' may be edited. Item prices are always re-read from products; client totals are ignored. */
export interface UpdateOrderInput {
  items: CreateOrderItemInput[];
  deliveryFee: number;
  discount: number;
  customerName: string;
  customerAddress: string;
  note?: string;
  deliveryDate?: string;
  actorName: string;
  actorUid?: string;
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
  logoUrl?: string;
  email?: string;
  notificationEnabled?: boolean;
}

export interface StoreSettings {
  storeName: string;
  phone: string;
  address: string;
  zaloUrl: string;
  logoUrl: string;
  email: string;
  notificationEnabled?: boolean;
}
