'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  PlusCircle, 
  Phone, 
  Calendar, 
  Filter, 
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader, EmptyState } from '@/components/common/Cards';
import { SearchInput } from '@/components/common/Input';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { orders } from '@/lib/services';
import { formatDate } from '@/lib/utils/format';
import { OrderStatus } from '@/types';

const STATUS_FILTERS: { id: string; label: string; value?: OrderStatus }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'new', label: 'Mới', value: 'new' },
  { id: 'confirmed', label: 'Đã xác nhận', value: 'confirmed' },
  { id: 'delivering', label: 'Đang giao', value: 'delivering' },
  { id: 'completed', label: 'Hoàn tất', value: 'completed' },
  { id: 'cancelled', label: 'Đã hủy', value: 'cancelled' },
];

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filteredOrders = useMemo(() => {
    return mockOrders.filter((order) => {
      // Filter status
      if (selectedStatus !== 'all' && order.status !== selectedStatus) {
        return false;
      }
      // Filter search
      if (!searchTerm.trim()) return true;
      const lower = searchTerm.toLowerCase();
      const matchId = order.id.toLowerCase().includes(lower);
      const matchName = order.customerSnapshot.name.toLowerCase().includes(lower);
      const matchPhone = order.customerSnapshot.phone.includes(lower);
      return matchId || matchName || matchPhone;
    });
  }, [searchTerm, selectedStatus]);

  return (
    <AppShell>
      <PageHeader
        title="Đơn hàng"
        subtitle="Quản lý toàn bộ danh sách đơn đặt hoa và trạng thái xử lý"
        action={
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo đơn mới</span>
          </Link>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-3 sm:p-4 mb-6 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm mã đơn, tên khách hoặc số điện thoại..."
            />
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 -mx-1 px-1 scrollbar-none">
          <span className="text-xs font-semibold text-stone-400 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Lọc:
          </span>
          {STATUS_FILTERS.map((filter) => {
            const isSelected = selectedStatus === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedStatus(filter.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          title="Không tìm thấy đơn hàng nào"
          description="Thử tìm kiếm với từ khóa khác hoặc điều chỉnh lại bộ lọc trạng thái."
          icon={ShoppingBag}
          action={
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo đơn hàng mới</span>
            </Link>
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-stone-200/80 shadow-2xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Mã đơn</th>
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4">Số điện thoại</th>
                  <th className="py-3 px-4">Tổng tiền</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Ngày tạo</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-stone-900">
                      <Link href={`/orders/${order.id}`} className="hover:text-rose-600 transition-colors">
                        #{order.id}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-stone-900 block">{order.customerSnapshot.name}</span>
                      <span className="text-xs text-stone-400 block max-w-[200px] truncate">{order.customerSnapshot.address}</span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 text-xs font-mono">
                      {order.customerSnapshot.phone}
                    </td>
                    <td className="py-3.5 px-4">
                      <MoneyDisplay amount={order.summary.total} size="md" className="text-stone-900" />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={order.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-stone-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <span>Chi tiết</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (Mobile-First responsive) */}
          <div className="md:hidden divide-y divide-stone-100">
            {filteredOrders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block p-4 hover:bg-stone-50 transition-colors active:bg-stone-100"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-base">#{order.id}</span>
                  </div>
                  <StatusBadge status={order.status} size="sm" />
                </div>

                <div className="flex items-baseline justify-between mt-2">
                  <div>
                    <h3 className="font-semibold text-sm text-stone-900">{order.customerSnapshot.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-stone-500 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{order.customerSnapshot.phone}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <MoneyDisplay amount={order.summary.total} size="lg" className="text-rose-600 font-bold" />
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-dashed border-stone-100 flex items-center justify-between text-xs text-stone-400">
                  <span className="truncate max-w-[200px] text-stone-500">{order.customerSnapshot.address}</span>
                  <span className="shrink-0 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(order.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
