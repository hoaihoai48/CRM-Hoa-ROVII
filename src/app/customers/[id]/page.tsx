'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  User, 
  ShoppingBag, 
  Calendar, 
  ArrowRight,
  PlusCircle
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader, StatCard } from '@/components/common/Cards';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { ZaloButton } from '@/components/common/ZaloButton';
import { mockCustomers, mockOrders } from '@/lib/services';
import { formatDateShort } from '@/lib/utils/format';

function CustomerDetailContent() {
  const params = useParams();
  const customerId = (params?.id as string) || 'CUST-001';

  const customer = mockCustomers.find((c) => c.id === customerId) || mockCustomers[0];

  // Orders belonging to this customer
  const customerOrders = mockOrders.filter((o) => o.customerId === customer.id);

  return (
    <AppShell>
      <PageHeader
        title={customer.name}
        subtitle={`Mã khách: ${customer.id} • Thành viên từ ${formatDateShort(customer.createdAt)}`}
        backHref="/customers"
        action={
          <div className="flex items-center gap-2">
            <ZaloButton phone={customer.phone} size="md" variant="primary" />
          </div>
        }
      />

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard
          title="Tổng số đơn hàng"
          value={`${customer.totalOrders} đơn`}
          subtitle="Tổng tích lũy theo hồ sơ khách"
          icon={ShoppingBag}
          iconBgColor="bg-blue-50 text-blue-700"
        />
        <StatCard
          title="Tổng chi tiêu"
          value={<MoneyDisplay amount={customer.totalSpent} size="xl" className="text-stone-900" />}
          subtitle="Tổng giá trị các đơn"
          icon={ShoppingBag}
          iconBgColor="bg-rose-50 text-rose-700"
        />
        <StatCard
          title="Đơn gần nhất"
          value={formatDateShort(customer.lastOrderDate)}
          subtitle="Theo hồ sơ khách hàng"
          icon={Calendar}
          iconBgColor="bg-emerald-50 text-emerald-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 pb-3 mb-3 border-b border-stone-100 flex items-center gap-2">
              <User className="w-4 h-4 text-rose-500" />
              Thông tin liên hệ
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-stone-400 block font-medium">Số điện thoại</span>
                <span className="text-stone-900 font-mono text-sm font-semibold mt-0.5 block">
                  {customer.phone}
                </span>
              </div>

              <div>
                <span className="text-stone-400 block font-medium">Địa chỉ thường giao</span>
                <span className="text-stone-800 font-medium mt-0.5 block leading-relaxed">
                  {customer.address}
                </span>
              </div>

              {customer.note && (
                <div className="pt-2 border-t border-dashed border-stone-100">
                  <span className="text-stone-400 block font-medium mb-1">Ghi chú sở thích của khách</span>
                  <p className="bg-rose-50/50 p-2.5 rounded-lg text-stone-700 italic border border-rose-100">
                    &ldquo;{customer.note}&rdquo;
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-stone-100">
              <Link
                href="/orders/new"
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tạo đơn hoa cho khách này</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (8 cols): Order History */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Lịch sử đơn hàng</h3>
                <p className="text-xs text-stone-500 mt-0.5">Các đơn khách đã từng đặt tại tiệm</p>
              </div>
              <span className="text-xs text-stone-400 font-medium">{customerOrders.length} đơn</span>
            </div>

            {customerOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">
                Chưa có đơn hàng nào trong bộ mock data cho khách này.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {customerOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50 transition-colors block"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-sm">#{order.id}</span>
                        <StatusBadge status={order.status} size="sm" />
                        <span className="text-xs text-stone-400 ml-1">{formatDateShort(order.createdAt)}</span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1 line-clamp-1">
                        {order.items.map((it) => `${it.productSnapshot.name} (x${it.quantity})`).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-dashed border-stone-100">
                      <MoneyDisplay amount={order.summary.total} size="md" className="text-stone-900 font-bold" />
                      <span className="text-xs font-semibold text-rose-600 inline-flex items-center gap-0.5">
                        Xem chi tiết <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function CustomerDetailPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-stone-500">Đang tải thông tin khách hàng...</div>}>
      <CustomerDetailContent />
    </React.Suspense>
  );
}
