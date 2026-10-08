'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  User, 
  Phone, 
  MapPin, 
  Clock
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/common/Cards';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { ZaloButton } from '@/components/common/ZaloButton';
import { mockOrders } from '@/lib/services';
import { formatDate, formatVND } from '@/lib/utils/format';
import { OrderStatus } from '@/types';
import { getNextOrderStatuses, canTransitionOrderStatus } from '@/lib/utils/order-status';

function OrderDetailContent() {
  const params = useParams();
  const orderId = (params?.id as string) || 'DH-1024';

  const initialOrder = mockOrders.find((o) => o.id === orderId) || mockOrders[0];
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(initialOrder.status);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleUpdateStatus = (newStatus: OrderStatus) => {
    if (!canTransitionOrderStatus(currentStatus, newStatus)) return;

    setCurrentStatus(newStatus);
    setStatusMessage(`Đã cập nhật trạng thái sang "${newStatus}" (mock action)`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <AppShell>
      <PageHeader
        title={`Đơn hàng #${orderId}`}
        subtitle={`Tạo lúc ${formatDate(initialOrder.createdAt)} bởi ${initialOrder.createdBy}`}
        backHref="/orders"
        action={
          <div className="flex items-center gap-2">
            <ZaloButton phone={initialOrder.customerSnapshot.phone} size="md" variant="outline" />
          </div>
        }
      />

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
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer ${classes[nextStatus]}`}
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
    </AppShell>
  );
}

export default function OrderDetailPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-stone-500">Đang tải chi tiết đơn hàng...</div>}>
      <OrderDetailContent />
    </React.Suspense>
  );
}
