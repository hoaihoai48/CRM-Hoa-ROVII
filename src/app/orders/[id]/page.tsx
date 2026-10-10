'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  User, 
  Phone, 
  MapPin, 
  Clock
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/common/Cards';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { ZaloButton } from '@/components/common/ZaloButton';
import { Input, Textarea } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { getOrderById, listActiveProducts, updateOrder, updateOrderStatus } from '@/lib/services';
import { formatDate, formatVND } from '@/lib/utils/format';
import { OrderStatus, Product } from '@/types';
import { getNextOrderStatuses, canTransitionOrderStatus } from '@/lib/utils/order-status';

function OrderDetailContent() {
  const params = useParams();
  const orderId = params?.id as string;
  const { membership: currentUser } = useAuth();

  const [initialOrder, setInitialOrder] = useState<Awaited<ReturnType<typeof getOrderById>> | null>(null);
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>('new');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  // Order edit state (only for status new/confirmed)
  const [isEditing, setIsEditing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});
  const [editDeliveryFee, setEditDeliveryFee] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadOrder = () => {
    if (!orderId) return;
    setIsLoading(true);
    setLoadError(null);
    getOrderById(orderId)
      .then((order) => {
        setInitialOrder(order);
        if (order) setCurrentStatus(order.status);
        if (!order) {
          setLoadError('Không tìm thấy đơn hàng.');
        } else {
          setLoadError(null);
        }
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Không thể tải đơn hàng.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    // External Firestore read — legitimate effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const effectiveLoadError = !orderId ? 'Mã đơn hàng không hợp lệ.' : loadError;

  if (isLoading && orderId) {
    return <div className="p-8 text-center text-sm text-stone-500">Đang tải chi tiết đơn hàng...</div>;
  }
  if (effectiveLoadError || !initialOrder) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600">{effectiveLoadError || 'Không tìm thấy đơn hàng.'}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          {orderId && loadError && (
            <button
              type="button"
              onClick={loadOrder}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
            >
              Thử tải lại
            </button>
          )}
          <Link href="/orders" className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg">
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }
  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!canTransitionOrderStatus(currentStatus, newStatus)) {
      setStatusMessage(`Không thể chuyển trạng thái từ "${currentStatus}" sang "${newStatus}".`);
      return;
    }
    if (!currentUser) {
      setStatusMessage('Chưa tải được tài khoản nhân viên, vui lòng thử lại.');
      return;
    }
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await updateOrderStatus(initialOrder.id, {
        status: newStatus,
        actorName: currentUser.name,
      });
      setInitialOrder(updated);
      setCurrentStatus(updated.status);
      setStatusMessage(`Đã cập nhật trạng thái sang "${newStatus}"`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái.');
    } finally {
      setIsUpdatingStatus(false);
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const canEditOrder = currentStatus === 'new' || currentStatus === 'confirmed';

  const startEditing = async () => {
    if (!initialOrder || !canEditOrder) return;
    setSaveError(null);
    setEditName(initialOrder.customerSnapshot.name);
    setEditAddress(initialOrder.customerSnapshot.address);
    setEditNote(initialOrder.note || '');
    setEditDeliveryFee(initialOrder.summary.deliveryFee);
    setEditDiscount(initialOrder.summary.discount);
    setEditDeliveryDate(initialOrder.deliveryDate ? initialOrder.deliveryDate.slice(0, 16) : '');
    const quantities: Record<string, number> = {};
    for (const item of initialOrder.items) {
      quantities[item.productId] = item.quantity;
    }
    setEditQuantities(quantities);
    setIsEditing(true);
    try {
      const activeProducts = await listActiveProducts();
      setProducts(activeProducts);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm để sửa.');
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const updateEditQuantity = (productId: string, delta: number) => {
    setEditQuantities((prev) => {
      const nextQty = (prev[productId] || 0) + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: nextQty };
    });
  };

  const handleSaveOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialOrder || !currentUser || isSaving) return;
    setSaveError(null);
    const items = Object.entries(editQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0) {
      setSaveError('Đơn hàng phải có ít nhất một sản phẩm.');
      return;
    }
    if (!editName.trim() || !editAddress.trim()) {
      setSaveError('Tên người nhận và địa chỉ giao hoa là bắt buộc.');
      return;
    }
    if (editDeliveryFee < 0 || editDiscount < 0) {
      setSaveError('Phí giao hàng và giảm giá không được âm.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateOrder(initialOrder.id, {
        items,
        deliveryFee: editDeliveryFee,
        discount: editDiscount,
        customerName: editName,
        customerAddress: editAddress,
        note: editNote,
        deliveryDate: editDeliveryDate ? new Date(editDeliveryDate).toISOString() : undefined,
        actorName: currentUser.name,
      });
      setInitialOrder(updated);
      setCurrentStatus(updated.status);
      setIsEditing(false);
      setStatusMessage('Đã lưu thay đổi đơn hàng.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      // Keep edit form data so nothing is lost on failure.
      setSaveError(error instanceof Error ? error.message : 'Không thể lưu thay đổi đơn hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={`Đơn hàng #${orderId}`}
        subtitle={`Tạo lúc ${formatDate(initialOrder.createdAt)} bởi ${initialOrder.createdBy}`}
        backHref="/orders"
        action={
          <div className="flex items-center gap-2">
            {canEditOrder && !isEditing && (
              <button
                type="button"
                onClick={startEditing}
                className="px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Sửa đơn hàng
              </button>
            )}
            <ZaloButton phone={initialOrder.customerSnapshot.phone} size="md" variant="outline" />
          </div>
        }
      />

      {isEditing && (
        <form onSubmit={handleSaveOrderEdit} className="mb-6 bg-white rounded-xl border border-rose-200 p-4 sm:p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-stone-900 pb-3 mb-4 border-b border-stone-100">
            Sửa đơn hàng (chỉ cho đơn Mới / Đã xác nhận — giá được tính lại từ bảng giá hiện tại)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Input
              label="Tên người nhận"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={isSaving}
            />
            <Input
              label="Địa chỉ giao hoa"
              required
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
            {(products.length > 0
              ? products
              : initialOrder.items.map((item) => ({
                  id: item.productId,
                  name: item.productSnapshot.name,
                  price: item.unitPrice,
                  unit: item.productSnapshot.unit,
                  isActive: true,
                } as Product))
            ).map((product) => {
              const qty = editQuantities[product.id] || 0;
              return (
                <div key={product.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-stone-200">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-900 truncate">{product.name}</p>
                    <p className="text-[11px] text-stone-500">{formatVND(product.price)} / {product.unit}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateEditQuantity(product.id, -1)}
                      disabled={qty === 0 || isSaving}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-xs font-bold tabular-nums">{qty}</span>
                    <button
                      type="button"
                      onClick={() => updateEditQuantity(product.id, 1)}
                      disabled={isSaving}
                      className="w-7 h-7 rounded-md flex items-center justify-center bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5" htmlFor="editDeliveryFee">Phí giao hàng</label>
              <input
                id="editDeliveryFee"
                type="number"
                min={0}
                step={5000}
                value={editDeliveryFee}
                onChange={(e) => setEditDeliveryFee(Number(e.target.value) || 0)}
                disabled={isSaving}
                className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5" htmlFor="editDiscount">Giảm giá</label>
              <input
                id="editDiscount"
                type="number"
                min={0}
                step={10000}
                value={editDiscount}
                onChange={(e) => setEditDiscount(Number(e.target.value) || 0)}
                disabled={isSaving}
                className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5" htmlFor="editDeliveryDate">Thời gian giao hoa</label>
              <input
                id="editDeliveryDate"
                type="datetime-local"
                value={editDeliveryDate}
                onChange={(e) => setEditDeliveryDate(e.target.value)}
                disabled={isSaving}
                className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>
          <Textarea
            label="Ghi chú đơn hàng"
            rows={2}
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            disabled={isSaving}
          />
          {saveError && (
            <div role="alert" className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {saveError}
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={cancelEditing} disabled={isSaving}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      )}

      {statusMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold cursor-pointer">×</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Order details & Products */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quick status bar */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-stone-500">Trạng thái hiện tại:</span>
              <StatusBadge status={currentStatus} size="lg" />
            </div>

            {/* Chỉ hiển thị các chuyển trạng thái hợp lệ theo workflow */}
            {getNextOrderStatuses(currentStatus).length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-semibold text-stone-400 mr-1">Chuyển:</span>
                {getNextOrderStatuses(currentStatus).map((nextStatus) => {
                  const labels: Record<OrderStatus, string> = {
                    new: 'Mới',
                    confirmed: 'Xác nhận',
                    delivering: 'Giao hàng',
                    completed: 'Hoàn tất',
                    cancelled: 'Hủy đơn',
                  };
                  const classes: Record<OrderStatus, string> = {
                    new: 'bg-stone-50 text-stone-600 hover:bg-stone-100 border-stone-200',
                    confirmed: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
                    delivering: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200',
                    completed: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200',
                    cancelled: 'bg-stone-100 text-stone-600 hover:bg-stone-200 border-stone-200',
                  };

                  return (
                      <button
                        key={nextStatus}
                        type="button"
                        onClick={() => handleUpdateStatus(nextStatus)}
                        disabled={isUpdatingStatus}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer disabled:opacity-50 ${classes[nextStatus]}`}
                      >
                      {labels[nextStatus]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer Snapshot Card */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <User className="w-4 h-4 text-rose-500" />
                Thông tin khách nhận (Customer Snapshot)
              </h3>
              <Link
                href={`/customers/${initialOrder.customerId}`}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Hồ sơ khách hàng →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-stone-400 font-medium">Người nhận / Người đặt</p>
                <p className="text-sm font-bold text-stone-900 mt-0.5">{initialOrder.customerSnapshot.name}</p>
                <p className="text-stone-600 flex items-center gap-1.5 mt-1">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span className="font-mono text-xs">{initialOrder.customerSnapshot.phone}</span>
                </p>
              </div>

              <div>
                <p className="text-stone-400 font-medium">Địa chỉ giao hoa</p>
                <p className="text-sm font-semibold text-stone-800 mt-0.5 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                  <span>{initialOrder.customerSnapshot.address}</span>
                </p>
              </div>
            </div>

            {initialOrder.note && (
              <div className="mt-3 pt-3 border-t border-dashed border-stone-100 bg-amber-50/50 p-2.5 rounded-lg">
                <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                  Ghi chú đơn & nội dung thiệp:
                </p>
                <p className="text-xs text-stone-700 mt-0.5 italic">{initialOrder.note}</p>
              </div>
            )}
          </div>

          {/* Products List & Snapshots */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900">Chi tiết sản phẩm đặt hoa</h3>
            </div>

            <div className="divide-y divide-stone-100 text-sm">
              {initialOrder.items.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-stone-900">{item.productSnapshot.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Đơn giá: {formatVND(item.unitPrice)} / {item.productSnapshot.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-md">
                      x{item.quantity}
                    </span>
                    <span className="font-bold text-stone-900 tabular-nums">
                      {formatVND(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Summary */}
            <div className="bg-stone-50/70 p-4 sm:p-5 border-t border-stone-100 space-y-2 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Tạm tính</span>
                <span className="font-medium text-stone-900">{formatVND(initialOrder.summary.subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Phí giao hàng</span>
                <span className="font-medium text-stone-900">{formatVND(initialOrder.summary.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Giảm giá</span>
                <span className="font-medium text-stone-900">-{formatVND(initialOrder.summary.discount)}</span>
              </div>
              <div className="border-t border-stone-200 pt-2 flex justify-between items-baseline">
                <span className="text-sm font-bold text-stone-900">Tổng thanh toán</span>
                <MoneyDisplay amount={initialOrder.summary.total} size="xl" className="text-rose-600 font-bold" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Timeline & History */}
        <div className="lg:col-span-4 space-y-6">
          {/* Order Status History Timeline */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 pb-3 mb-4 border-b border-stone-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-500" />
              Lịch sử trạng thái (Timeline)
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
              {initialOrder.statusHistory.map((history) => (
                <div key={history.id} className="relative">
                  {/* Dot */}
                  <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full border-2 border-white bg-rose-500 shadow-2xs ring-2 ring-rose-100" />
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-900">{formatDate(history.timestamp)}</span>
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={history.status} size="sm" />
                    </div>
                    {history.note && (
                      <p className="text-xs text-stone-600 mt-1 bg-stone-50 p-2 rounded-md">
                        {history.note}
                      </p>
                    )}
                    <p className="text-[11px] text-stone-400 mt-1">Bởi: {history.actorName}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100">
              <p className="text-[11px] text-stone-400 leading-relaxed">
                * Cấu trúc sẵn sàng map trực tiếp vào subcollection Firestore <code>orders/{'{orderId}'}/statusHistory</code> ở Phase 2.
              </p>
            </div>
          </div>
        </div>
      </div>
    
    </>
  );
}

function OrderDetailPageContent() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-stone-500">Đang tải chi tiết đơn hàng...</div>}>
      <OrderDetailContent />
    </React.Suspense>
  );
}


export default function OrderDetailPage() {
  return (
    <AppShell>
      <OrderDetailPageContent />
    </AppShell>
  );
}
