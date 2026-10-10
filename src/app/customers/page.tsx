'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
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
import { createCustomer, listCustomers } from '@/lib/services';
import { formatDateShort } from '@/lib/utils/format';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof listCustomers>>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadCustomers = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    listCustomers()
      .then(setCustomers)
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Không thể tải danh sách khách hàng.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const lower = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.phone.includes(lower) ||
        c.address.toLowerCase().includes(lower)
    );
  }, [customers, searchTerm]);

  return (
    <AppShell>
      <PageHeader
        title="Khách hàng"
        subtitle="Quản lý danh sách khách và lịch sử đặt hoa"
        action={
          <button
            type="button"
            onClick={() => { setCreateError(null); setShowCreateForm((shown) => !shown); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm khách hàng</span>
          </button>
        }
      />

      {showCreateForm && (
        <form onSubmit={async (event) => {
          event.preventDefault();
          if (isCreating) return;
          setCreateError(null);
          setIsCreating(true);
          try {
            await createCustomer({ name: newName, phone: newPhone, address: newAddress, note: newNote });
            setNewName(''); setNewPhone(''); setNewAddress(''); setNewNote('');
            setShowCreateForm(false);
            loadCustomers();
          } catch (error) {
            setCreateError(error instanceof Error ? error.message : 'Không thể tạo khách hàng.');
          } finally {
            setIsCreating(false);
          }
        }} className="mb-6 rounded-xl border border-stone-200 bg-white p-4 sm:p-6 shadow-2xs space-y-4">
          <h2 className="font-bold text-stone-900">Thêm khách hàng mới</h2>
          {createError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{createError}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-stone-700">Tên khách hàng<input required value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-stone-700">Số điện thoại<input required type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-stone-700 sm:col-span-2">Địa chỉ<input required value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-stone-700 sm:col-span-2">Ghi chú (không bắt buộc)<textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" /></label>
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold">Hủy</button><button type="submit" disabled={isCreating} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{isCreating ? 'Đang lưu...' : 'Lưu khách hàng'}</button></div>
        </form>
      )}

      {/* Search Input Bar */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-3 sm:p-4 mb-6 shadow-2xs">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm tên hoặc số điện thoại khách hàng..."
        />
      </div>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p>Không thể tải danh sách khách hàng: {loadError}</p>
          <button type="button" onClick={loadCustomers} className="mt-3 underline font-semibold">Thử tải lại</button>
        </div>
      ) : isLoading ? (
        <p role="status" className="py-8 text-center text-sm text-stone-500">Đang tải danh sách khách hàng...</p>
      ) : filteredCustomers.length === 0 ? (
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
