'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  UserCheck, 
  UserPlus, 
  Search, 
  Plus, 
  Minus, 
  Check, 
  Phone, 
  MapPin
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/common/Cards';
import { Input, Textarea } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { createCustomer, createOrder, findCustomerByPhone, listActiveProducts, listCustomers } from '@/lib/services';
import { Customer, Product } from '@/types';
import { formatVND } from '@/lib/utils/format';

interface CartItem {
  product: Product;
  quantity: number;
}

function CreateOrderPageContent() {
  const router = useRouter();
  const { membership: currentUser } = useAuth();

  // Step 1: Customer flow
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof listCustomers>>>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof listActiveProducts>>>([]);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFormData = useCallback(() => {
    setIsLoadingData(true);
    setLoadError(null);
    Promise.all([listCustomers(), listActiveProducts()])
      .then(([loadedCustomers, loadedProducts]) => {
        setCustomers(loadedCustomers);
        setProducts(loadedProducts);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Không thể tải dữ liệu tạo đơn hàng.'))
      .finally(() => setIsLoadingData(false));
  }, []);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  // Suggestion match based on phone
  const normalizedPhone = phoneSearch.replace(/\D/g, '');
  const matchedCustomer = useMemo(() => {
    if (normalizedPhone.length < 3) return null;
    return customers.find((c) => c.phoneNormalized.includes(normalizedPhone)) || null;
  }, [customers, normalizedPhone]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPhoneSearch(customer.phone);
    setCustomerName(customer.name);
    setCustomerAddress(customer.address);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setPhoneSearch('');
    setCustomerName('');
    setCustomerAddress('');
  };

  // Step 2: Product items
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      if (!productSearch.trim()) return true;
      return p.name.toLowerCase().includes(productSearch.toLowerCase());
    });
  }, [products, productSearch]);

  const updateQuantity = (product: Product, delta: number) => {
    setCart((prevCart) => {
      const existing = prevCart.find((it) => it.product.id === product.id);
      if (existing) {
        const nextQty = existing.quantity + delta;
        if (nextQty <= 0) {
          return prevCart.filter((it) => it.product.id !== product.id);
        }
        return prevCart.map((it) =>
          it.product.id === product.id ? { ...it, quantity: nextQty } : it
        );
      } else if (delta > 0) {
        return [...prevCart, { product, quantity: 1 }];
      }
      return prevCart;
    });
  };

  const getProductQuantity = (productId: string) => {
    const item = cart.find((it) => it.product.id === productId);
    return item ? item.quantity : 0;
  };

  // Step 3: Order Summary calculations
  const [deliveryFee, setDeliveryFee] = useState<number>(30000);
  const [discount, setDiscount] = useState<number>(0);

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = Math.max(0, subtotal + Math.max(0, deliveryFee) - Math.min(Math.max(0, discount), subtotal));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (normalizedPhone.length < 8) {
      setFormError('Vui lòng nhập số điện thoại hợp lệ.');
      return;
    }
    if (!customerName.trim() || !customerAddress.trim()) {
      setFormError('Vui lòng nhập đầy đủ tên khách hàng và địa chỉ giao hoa.');
      return;
    }
    if (cart.length === 0) {
      setFormError('Vui lòng chọn ít nhất một sản phẩm.');
      return;
    }
    if (deliveryFee < 0 || discount < 0) {
      setFormError('Phí giao hàng và giảm giá không được âm.');
      return;
    }
    if (discount > subtotal) {
      setFormError('Giảm giá không được lớn hơn tạm tính hàng.');
      return;
    }

    if (!currentUser) {
      setFormError('Chưa tải được tài khoản nhân viên.');
      return;
    }

    setIsSubmitting(true);
    try {
      const existingCustomer = selectedCustomer ?? await findCustomerByPhone(phoneSearch);
      const customer = existingCustomer ?? await createCustomer({
        name: customerName,
        phone: phoneSearch,
        address: customerAddress,
      });

      const order = await createOrder({
        customerId: customer.id,
        customerSnapshot: {
          name: customerName.trim(),
          phone: phoneSearch.trim(),
          address: customerAddress.trim(),
        },
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        deliveryFee,
        discount,
        note: orderNote,
        deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        createdBy: currentUser.name,
      });

      router.push(`/orders/${order.id}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể tạo đơn hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    
      <PageHeader
        title="Tạo đơn hàng"
        subtitle="Nhập đơn nhanh từ cuộc gọi hoặc tin nhắn Zalo"
        backHref="/orders"
      />

      {loadError && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>Không thể tải dữ liệu tạo đơn hàng: {loadError}</p><button type="button" onClick={loadFormData} className="mt-2 underline font-semibold">Thử tải lại</button></div>}
      {isLoadingData && <p role="status" className="mb-4 text-sm text-stone-500">Đang tải khách hàng và sản phẩm...</p>}
      <form onSubmit={handleSaveOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12">
        {/* Left Column: Customer and Products (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* SECTION 1: CUSTOMER INFO */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-base font-bold text-stone-900">Thông tin khách hàng</h2>
              </div>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                >
                  Đổi khách hàng
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Phone search with quick lookup simulation */}
              <div>
                <Input
                  label="Số điện thoại"
                  type="tel"
                  required
                  placeholder="Nhập SĐT khách hàng (vd: 0901234567)..."
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4" />}
                />

                {/* Customer match suggestion card */}
                {matchedCustomer && !selectedCustomer && (
                  <div className="mt-2.5 p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in-50 duration-200">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                            Đã tìm thấy khách hàng cũ
                          </span>
                          <span className="text-[11px] px-1.5 py-0.2 bg-emerald-200/60 text-emerald-800 rounded font-medium">
                            {matchedCustomer.totalOrders} đơn
                          </span>
                        </div>
                        <p className="text-sm font-bold text-stone-900 mt-0.5">{matchedCustomer.name}</p>
                        <p className="text-xs text-stone-600 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                          <span>{matchedCustomer.address}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectCustomer(matchedCustomer)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                    >
                      Chọn khách này
                    </button>
                  </div>
                )}

                {!matchedCustomer && phoneSearch.length >= 8 && !selectedCustomer && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1 font-medium">
                    <UserPlus className="w-3.5 h-3.5" />
                    Chưa có trong danh bạ — sẽ tạo hồ sơ khách mới khi lưu đơn
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Tên khách hàng"
                  required
                  placeholder="Họ và tên người nhận/người đặt"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <Input
                  label="Địa chỉ giao hoa"
                  required
                  placeholder="Số nhà, tên đường, phường, quận..."
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  leftIcon={<MapPin className="w-4 h-4" />}
                />
              </div>

              <Textarea
                label="Ghi chú đơn hàng & lời nhắn thiệp"
                rows={2}
                placeholder="Nội dung thiệp chúc mừng, giờ giao cụ thể, dặn dò shipper..."
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
              />
            </div>
          </div>

          {/* SECTION 2: PRODUCT PICKER */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-stone-100 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-bold text-stone-900">Chọn sản phẩm hoa</h2>
              </div>
              <div className="w-full sm:w-64">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Tìm tên mẫu hoa..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Product items quick selector grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredProducts.map((product) => {
                const qty = getProductQuantity(product.id);
                return (
                  <div
                    key={product.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      qty > 0
                        ? 'border-rose-300 bg-rose-50/40'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-semibold text-stone-900 truncate">{product.name}</p>
                      <p className="text-xs font-medium text-rose-600 mt-0.5">
                        {formatVND(product.price)} <span className="text-stone-400 font-normal">/ {product.unit}</span>
                      </p>
                    </div>

                    {/* Quantity counter */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-white p-1 rounded-lg border border-stone-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(product, -1)}
                        disabled={qty === 0}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                        title="Giảm"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-stone-800 tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(product, 1)}
                        className="w-7 h-7 rounded-md flex items-center justify-center bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer transition-colors font-bold"
                        title="Tăng"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary (4 cols) */}
        <div className="lg:col-span-4 sticky top-6 space-y-4">
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900 pb-3 mb-3 border-b border-stone-100">
              Chi tiết thanh toán
            </h2>

            {/* Selected items list preview */}
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-4">Chưa chọn sản phẩm nào</p>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between text-xs py-1 border-b border-stone-50">
                    <span className="text-stone-700 truncate max-w-[160px]">
                      {item.product.name} <span className="text-stone-400 font-medium">x{item.quantity}</span>
                    </span>
                    <span className="font-semibold text-stone-900 shrink-0">
                      {formatVND(item.product.price * item.quantity)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mb-4 pt-3 border-t border-stone-100">
              <label className="block text-xs font-semibold text-stone-700 mb-1.5" htmlFor="deliveryDate">
                Thời gian giao hoa
              </label>
              <input
                id="deliveryDate"
                type="datetime-local"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 text-xs border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Fee adjustments */}
            <div className="space-y-2.5 text-xs text-stone-600 border-t border-stone-100 pt-3">
              <div className="flex justify-between items-center">
                <span>Tạm tính hàng</span>
                <span className="font-semibold text-stone-900">{formatVND(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span>Phí giao hàng</span>
                <div className="w-24">
                  <input
                    type="number"
                    step="5000"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
                    className="w-full text-right px-2 py-1 text-xs border border-stone-200 rounded font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span>Giảm giá</span>
                <div className="w-24">
                  <input
                    type="number"
                    step="10000"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    className="w-full text-right px-2 py-1 text-xs border border-stone-200 rounded font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="border-t border-stone-200 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-bold text-stone-900">Tổng cộng</span>
                <MoneyDisplay amount={total} size="xl" className="text-rose-600 font-bold" />
              </div>
            </div>

            {formError && (
              <div className={`mt-4 p-3 rounded-lg border text-xs ${formError.startsWith('Đã kiểm tra') ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {formError}
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-5 space-y-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isLoadingData || !!loadError || !currentUser || cart.length === 0}
                isLoading={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold text-sm shadow-md"
                rightIcon={<Check className="w-4 h-4" />}
              >
                Lưu đơn hàng
              </Button>
              <button
                type="button"
                onClick={() => router.push('/orders')}
                className="w-full py-2.5 text-xs font-semibold text-stone-500 hover:text-stone-800 text-center cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      </form>
    
  );
}


export default function CreateOrderPage() {
  return (
    <AppShell>
      <CreateOrderPageContent />
    </AppShell>
  );
}
