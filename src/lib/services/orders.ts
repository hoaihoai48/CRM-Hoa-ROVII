import { CreateOrderInput, Order, UpdateOrderStatusInput } from '@/types';
import { mockCustomers, mockOrders, mockProducts } from '@/lib/mock';
import { canTransitionOrderStatus } from '@/lib/utils/order-status';

function recalculateCustomerAggregates(): void {
  for (const customer of mockCustomers) {
    const customerOrders = mockOrders.filter((order) => order.customerId === customer.id);
    const activeOrders = customerOrders.filter((order) => order.status !== 'cancelled');
    const completedOrders = customerOrders.filter((order) => order.status === 'completed');

    customer.totalOrders = activeOrders.length;
    customer.totalSpent = completedOrders.reduce((sum, order) => sum + order.summary.total, 0);
    customer.lastOrderDate = activeOrders.map((order) => order.createdAt).sort().at(-1) ?? '';
  }
}

export async function listOrders(): Promise<Order[]> {
  return [...mockOrders];
}

export async function getOrderById(id: string): Promise<Order | null> {
  return mockOrders.find((order) => order.id === id) ?? null;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (!input.customerId) throw new Error('Khách hàng là bắt buộc.');
  if (!input.customerSnapshot.name.trim() || !input.customerSnapshot.phone.trim() || !input.customerSnapshot.address.trim()) {
    throw new Error('Thông tin snapshot khách hàng chưa đầy đủ.');
  }
  if (input.items.length === 0) throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');
  if (input.deliveryFee < 0 || input.discount < 0) throw new Error('Phí giao hàng và giảm giá không được âm.');

  const items = input.items.map((item, index) => {
    if (item.quantity <= 0) throw new Error('Số lượng sản phẩm phải lớn hơn 0.');
    const product = mockProducts.find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error(`Không tìm thấy sản phẩm: ${item.productId}`);
    if (!product.isActive) throw new Error(`Sản phẩm đã ngừng bán: ${product.name}`);

    return {
      id: `ITEM-${Date.now()}-${index}`,
      productId: product.id,
      productSnapshot: { name: product.name, unit: product.unit },
      quantity: item.quantity,
      unitPrice: product.price,
      subtotal: product.price * item.quantity,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  if (input.discount > subtotal) throw new Error('Giảm giá không được lớn hơn tạm tính hàng.');

  const now = new Date().toISOString();
  const order: Order = {
    id: `DH-${Date.now()}`,
    customerId: input.customerId,
    customerSnapshot: { ...input.customerSnapshot },
    items,
    summary: { subtotal, deliveryFee: input.deliveryFee, discount: input.discount, total: subtotal + input.deliveryFee - input.discount },
    status: 'new',
    statusHistory: [{
      id: `HIST-${Date.now()}`,
      status: 'new',
      timestamp: now,
      actorName: input.createdBy,
      note: 'Đơn hàng được tạo',
    }],
    note: input.note?.trim() || undefined,
    createdAt: now,
    createdBy: input.createdBy,
    deliveryDate: input.deliveryDate || undefined,
  };

  mockOrders.unshift(order);
  recalculateCustomerAggregates();
  return order;
}

export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput): Promise<Order> {
  const order = mockOrders.find((item) => item.id === id);
  if (!order) throw new Error('Không tìm thấy đơn hàng.');
  if (!canTransitionOrderStatus(order.status, input.status)) {
    throw new Error(`Không thể chuyển trạng thái từ "${order.status}" sang "${input.status}".`);
  }

  const now = new Date().toISOString();
  order.status = input.status;
  order.statusHistory.push({
    id: `HIST-${Date.now()}`,
    status: input.status,
    timestamp: now,
    actorName: input.actorName,
    note: input.note?.trim() || undefined,
  });

  recalculateCustomerAggregates();
  return order;
}
