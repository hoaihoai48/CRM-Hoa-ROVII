import React from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  Banknote, 
  PlusCircle, 
  Users, 
  Flower2, 
  ArrowRight,
  Phone
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader, StatCard } from '@/components/common/Cards';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { ZaloButton } from '@/components/common/ZaloButton';
import { mockOrders } from '@/lib/mock';
import { formatDate } from '@/lib/utils/format';

export default function DashboardPage() {
  const now = new Date();
  const todayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const todayOrders = mockOrders.filter((order) => order.createdAt.slice(0, 10) === todayKey);
  const newOrders = todayOrders.filter((order) => order.status === 'new');
  const processingOrders = todayOrders.filter(
    (order) => order.status === 'confirmed' || order.status === 'delivering'
  );
  const completedOrders = todayOrders.filter((order) => order.status === 'completed');
  const todayRevenue = completedOrders.reduce((sum, order) => sum + order.summary.total, 0);
  const recentOrders = mockOrders.slice(0, 6);

  return (
    <AppShell>
      {/* Page Header */}
      <PageHeader
        title="Tổng quan"
        subtitle="Tình hình đơn hàng và hoạt động của tiệm hôm nay"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo đơn mới</span>
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        <StatCard
          title="Đơn hôm nay"
          value={todayOrders.length}
          subtitle="Đơn phát sinh hôm nay"
          icon={ShoppingBag}
          iconBgColor="bg-stone-100 text-stone-700"
        />
        <StatCard
          title="Đơn mới"
          value={newOrders.length}
          subtitle="Cần xác nhận ngay"
          icon={Sparkles}
          iconBgColor="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Đang xử lý"
          value={processingOrders.length}
          subtitle="Đã xác nhận hoặc đang giao"
          icon={Clock}
          iconBgColor="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Hoàn tất"
          value={completedOrders.length}
          subtitle="Đã giao thành công"
          icon={CheckCircle2}
          iconBgColor="bg-rose-50 text-rose-700"
        />
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            title="Doanh thu hôm nay"
            value={`${todayRevenue.toLocaleString("vi-VN")}đ`}
            subtitle="Doanh thu từ đơn hoàn tất"
            icon={Banknote}
            iconBgColor="bg-blue-50 text-blue-700"
          />
        </div>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 mb-8 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">Thao tác nhanh</h2>
          <ZaloButton size="sm" variant="subtle" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Link
            href="/orders/new"
            className="flex items-center gap-3 p-3 rounded-lg border border-stone-100 bg-stone-50 hover:bg-emerald-50 hover:border-emerald-200 transition-colors group"
          >
            <div className="p-2 rounded-md bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800 group-hover:text-emerald-800">Tạo đơn hàng</p>
              <p className="text-xs text-stone-400">Nhập đơn Zalo/gọi</p>
            </div>
          </Link>

          <Link
            href="/orders"
            className="flex items-center gap-3 p-3 rounded-lg border border-stone-100 bg-stone-50 hover:bg-rose-50 hover:border-rose-200 transition-colors group"
          >
            <div className="p-2 rounded-md bg-rose-100 text-rose-700 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800 group-hover:text-rose-800">Danh sách đơn</p>
              <p className="text-xs text-stone-400">Theo dõi giao hàng</p>
            </div>
          </Link>

          <Link
            href="/customers"
            className="flex items-center gap-3 p-3 rounded-lg border border-stone-100 bg-stone-50 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
          >
            <div className="p-2 rounded-md bg-blue-100 text-blue-700 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800 group-hover:text-blue-800">Khách hàng</p>
              <p className="text-xs text-stone-400">Tra cứu & lịch sử</p>
            </div>
          </Link>

          <Link
            href="/products"
            className="flex items-center gap-3 p-3 rounded-lg border border-stone-100 bg-stone-50 hover:bg-amber-50 hover:border-amber-200 transition-colors group"
          >
            <div className="p-2 rounded-md bg-amber-100 text-amber-700 group-hover:scale-105 transition-transform">
              <Flower2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800 group-hover:text-amber-800">Bảng giá hoa</p>
              <p className="text-xs text-stone-400">Mẫu hoa đang bán</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100">
          <div>
            <h2 className="text-base font-bold text-stone-900">Đơn hàng gần đây</h2>
            <p className="text-xs text-stone-500 mt-0.5">Theo dõi các đơn mới nhất cần xử lý</p>
          </div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
          >
            <span>Xem tất cả</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/70 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                <th className="py-3 px-4">Mã đơn</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Sản phẩm</th>
                <th className="py-3 px-4">Tổng tiền</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-stone-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-stone-900">
                    <Link href={`/orders/${order.id}`} className="hover:text-rose-600 transition-colors">
                      #{order.id}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-stone-900">{order.customerSnapshot.name}</div>
                    <div className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {order.customerSnapshot.phone}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-xs text-stone-600 max-w-xs truncate">
                      {order.items.map((it) => `${it.productSnapshot.name} (x${it.quantity})`).join(', ')}
                    </div>
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
                      className="inline-flex items-center text-xs font-semibold text-stone-500 hover:text-stone-900 px-2.5 py-1 rounded-md hover:bg-stone-100 transition-colors"
                    >
                      Xem
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile List/Card View */}
        <div className="md:hidden divide-y divide-stone-100">
          {recentOrders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block p-4 hover:bg-stone-50 transition-colors active:bg-stone-100"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="font-bold text-stone-900 text-sm">#{order.id}</span>
                  <span className="text-xs text-stone-400 ml-2">{formatDate(order.createdAt)}</span>
                </div>
                <StatusBadge status={order.status} size="sm" />
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <div>
                  <p className="font-semibold text-sm text-stone-800">{order.customerSnapshot.name}</p>
                  <p className="text-xs text-stone-500">{order.customerSnapshot.phone}</p>
                </div>
                <MoneyDisplay amount={order.summary.total} size="md" className="text-rose-600 font-bold" />
              </div>

              <p className="text-xs text-stone-500 line-clamp-1 mt-1.5 pt-1.5 border-t border-dashed border-stone-100">
                {order.items.map((it) => `${it.productSnapshot.name} (x${it.quantity})`).join(', ')}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
