'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Users, 
  UserPlus, 
  Phone, 
  MapPin, 
  ChevronRight
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader, EmptyState } from '@/components/common/Cards';
import { SearchInput } from '@/components/common/Input';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { ZaloButton } from '@/components/common/ZaloButton';
import { listCustomers } from '@/lib/services';
import { formatDateShort } from '@/lib/utils/format';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof listCustomers>>>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    listCustomers().then(setCustomers);
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const lower = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.phone.includes(lower) ||
        c.address.toLowerCase().includes(lower)
    );
  }, [searchTerm]);

  return (
    <AppShell>
      <PageHeader
        title="Khách hàng"
        subtitle="Quản lý danh sách khách và lịch sử đặt hoa"
        action={
          <button
            type="button"
            onClick={() => alert('Thêm khách hàng (Mở popup hoặc chuyển tới form thêm khách - Mock UI)')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm khách hàng</span>
          </button>
        }
      />

      {/* Search Input Bar */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-3 sm:p-4 mb-6 shadow-2xs">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm tên hoặc số điện thoại khách hàng..."
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          title="Chưa có khách hàng phù hợp"
          description="Không tìm thấy khách hàng với số điện thoại hoặc tên này."
          icon={Users}
        />
      ) : (
        <div className="bg-white rounded-xl border border-stone-200/80 shadow-2xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Tên khách hàng</th>
                  <th className="py-3 px-4">Số điện thoại</th>
                  <th className="py-3 px-4">Địa chỉ</th>
                  <th className="py-3 px-4 text-center">Số đơn</th>
                  <th className="py-3 px-4 text-right">Tổng chi tiêu</th>
                  <th className="py-3 px-4">Đơn gần nhất</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-bold text-stone-900 hover:text-rose-600 transition-colors"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-stone-600">
                      {customer.phone}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-stone-500 max-w-[220px] truncate">
                      {customer.address}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                        {customer.totalOrders}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-stone-900">
                      <MoneyDisplay amount={customer.totalSpent} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-stone-500">
                      {formatDateShort(customer.lastOrderDate)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <ZaloButton phone={customer.phone} size="sm" variant="subtle" />
                        <Link
                          href={`/customers/${customer.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
                        >
                          Chi tiết
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-stone-100">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="p-4 hover:bg-stone-50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <Link href={`/customers/${customer.id}`} className="font-bold text-stone-900 text-sm hover:text-rose-600">
                    {customer.name}
                  </Link>
                  <ZaloButton phone={customer.phone} size="sm" variant="outline">
                    Zalo
                  </ZaloButton>
                </div>

                <div className="text-xs text-stone-500 space-y-1 mt-1">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-stone-400" />
                    <span>{customer.phone}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{customer.address}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-dashed border-stone-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-stone-500">
                      Đơn: <strong className="text-stone-800 font-semibold">{customer.totalOrders}</strong>
                    </span>
                    <span className="text-stone-500">
                      Chi: <MoneyDisplay amount={customer.totalSpent} size="sm" className="text-rose-600 font-bold" />
                    </span>
                  </div>
                  <Link
                    href={`/customers/${customer.id}`}
                    className="inline-flex items-center gap-0.5 text-rose-600 font-semibold"
                  >
                    <span>Lịch sử</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
