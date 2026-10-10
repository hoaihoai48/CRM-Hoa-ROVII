'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { Input, Textarea } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { getCustomerById, listOrdersByCustomer, updateCustomer } from '@/lib/services';
import { formatDateShort } from '@/lib/utils/format';

function CustomerDetailContent() {
  const params = useParams();
  const customerId = params?.id as string;
  const [initialCustomer, setInitialCustomer] = useState<Awaited<ReturnType<typeof getCustomerById>>>(null);
  const [customerOrders, setCustomerOrders] = useState<Awaited<ReturnType<typeof listOrdersByCustomer>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const ignoreRef = useRef(false);

  const loadData = () => {
    if (!customerId) return;
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getCustomerById(customerId), listOrdersByCustomer(customerId)])
      .then(([customer, orders]) => {
        if (ignoreRef.current) return;
        setInitialCustomer(customer);
        setCustomerOrders(orders);
        if (!customer) {
          setLoadError('Không tìm thấy khách hàng.');
        } else {
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!ignoreRef.current) {
          setLoadError(error instanceof Error ? error.message : 'Không thể tải hồ sơ khách hàng.');
        }
      })
      .finally(() => {
        if (!ignoreRef.current) {
          setIsLoading(false);
        }
      });
  };

  useEffect(() => {
    ignoreRef.current = false;
    // External Firestore read — legitimate effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    return () => {
      ignoreRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const startEditing = () => {
    if (!initialCustomer) return;
    setEditName(initialCustomer.name);
    setEditAddress(initialCustomer.address);
    setEditNote(initialCustomer.note || '');
    setSaveError(null);
    setSaveMessage(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialCustomer || isSaving) return;
    setSaveError(null);
    setSaveMessage(null);
    if (!editName.trim()) {
      setSaveError('Tên khách hàng là bắt buộc.');
      return;
    }
    if (!editAddress.trim()) {
      setSaveError('Địa chỉ khách hàng là bắt buộc.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateCustomer(initialCustomer.id, {
        name: editName,
        address: editAddress,
        note: editNote,
      });
      setInitialCustomer(updated);
      setIsEditing(false);
      setSaveMessage('Đã lưu thông tin khách hàng.');
    } catch (error) {
      // Keep form data so nothing is lost on failure.
      setSaveError(error instanceof Error ? error.message : 'Không thể lưu thông tin khách hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  const effectiveLoadError = !customerId ? 'Mã khách hàng không hợp lệ.' : loadError;

  if (isLoading && customerId) {
    return <div className="p-8 text-center text-sm text-stone-500">Đang tải hồ sơ khách hàng...</div>;
  }
  if (effectiveLoadError || !initialCustomer) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600">{effectiveLoadError || 'Không tìm thấy khách hàng.'}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
          >
            Thử tải lại
          </button>
          <Link href="/customers" className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg">
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  const customer = initialCustomer;

  return (
    <>
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

      {saveMessage && (
        <div role="status" className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span>{saveMessage}</span>
          <button type="button" onClick={() => setSaveMessage(null)} className="font-bold cursor-pointer">×</button>
        </div>
      )}

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
            <div className="pb-3 mb-3 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <User className="w-4 h-4 text-rose-500" />
                Thông tin liên hệ
              </h3>
              {!isEditing && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Sửa thông tin
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveCustomer} className="space-y-3">
                <div>
                  <span className="text-stone-400 block font-medium text-xs">Số điện thoại (định danh, không đổi được)</span>
                  <span className="text-stone-900 font-mono text-sm font-semibold mt-0.5 block">
                    {customer.phone}
                  </span>
                </div>
                <Input
                  label="Tên khách hàng"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSaving}
                />
                <Input
                  label="Địa chỉ thường giao"
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  disabled={isSaving}
                />
                <Textarea
                  label="Ghi chú sở thích của khách"
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  disabled={isSaving}
                />
                {saveError && (
                  <div role="alert" className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    {saveError}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={cancelEditing} disabled={isSaving}>
                    Hủy
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                    Lưu thay đổi
                  </Button>
                </div>
              </form>
            ) : (
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
            )}

            <div className="mt-5 pt-4 border-t border-stone-100">
              <Link
                href={`/orders/new?customerId=${encodeURIComponent(customer.id)}`}
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
                Chưa có đơn hàng nào trong hệ thống cho khách này.
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
    </>
  );
}

function CustomerDetailPageContent() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-stone-500">Đang tải thông tin khách hàng...</div>}>
      <CustomerDetailContent />
    </React.Suspense>
  );
}


export default function CustomerDetailPage() {
  return (
    <AppShell>
      <CustomerDetailPageContent />
    </AppShell>
  );
}
