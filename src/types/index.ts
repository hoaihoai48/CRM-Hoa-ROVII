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

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  avatarUrl?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
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
  note?: string;
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

export interface StoreSettings {
  storeName: string;
  phone: string;
  address: string;
  zaloUrl: string;
  email: string;
  notificationEnabled?: boolean;
}
