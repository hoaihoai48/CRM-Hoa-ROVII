'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Store, 
  User, 
  Phone, 
  MapPin, 
  Mail, 
  MessageCircle, 
  LogOut, 
  Check
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/common/Cards';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { getCurrentUser, getStoreSettings, updateStoreSettings } from '@/lib/services';
import { useAuth } from '@/components/auth/AuthProvider';

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();

  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [zaloUrl, setZaloUrl] = useState('');

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getStoreSettings(), getCurrentUser()])
      .then(([settings, user]) => {
        setStoreName(settings.storeName);
        setStorePhone(settings.phone);
        setStoreAddress(settings.address);
        setZaloUrl(settings.zaloUrl);
        if (user) {
          setUserName(user.name);
          setUserEmail(user.email);
        }
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Không thể tải cài đặt.'));
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    updateStoreSettings({ storeName, phone: storePhone, address: storeAddress, zaloUrl })
      .then(() => {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Không thể lưu cài đặt.'));
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <AppShell>
      <PageHeader
        title="Cài đặt hệ thống"
        subtitle="Thông tin cửa hàng, tài khoản nhân viên và liên kết mạng xã hội"
      />

      {errorMessage && (
        <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">
          {errorMessage}
        </div>
      )}

      {isSaved && (
        <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Đã lưu cài đặt.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        {/* Section 1: Store Information */}
        <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-2xs">
          <h2 className="text-base font-bold text-stone-900 pb-3 mb-4 border-b border-stone-100 flex items-center gap-2">
            <Store className="w-4 h-4 text-rose-500" />
            Thông tin cửa hàng
          </h2>

          <div className="space-y-4">
            <Input
              label="Tên tiệm hoa"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Tiệm Hoa..."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Số điện thoại hotline"
                type="tel"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                leftIcon={<Phone className="w-4 h-4" />}
              />
              <Input
                label="Link Zalo OA / Zalo cá nhân của tiệm"
                value={zaloUrl}
                onChange={(e) => setZaloUrl(e.target.value)}
                hint="Ví dụ: https://zalo.me/0909888999 (Placeholder)"
                leftIcon={<MessageCircle className="w-4 h-4" />}
              />
            </div>

            <Input
              label="Địa chỉ cửa hàng"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              leftIcon={<MapPin className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Section 2: Current Account */}
        <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-2xs">
          <h2 className="text-base font-bold text-stone-900 pb-3 mb-4 border-b border-stone-100 flex items-center gap-2">
            <User className="w-4 h-4 text-rose-500" />
            Tài khoản nhân viên đang đăng nhập
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tên nhân viên"
              value={userName}
              disabled
              hint="Tên tài khoản lấy từ Firebase Authentication; không thể thay đổi tại màn hình này"
            />
            <Input
              label="Email đăng nhập"
              type="email"
              value={userEmail}
              disabled
              hint="Email không thể thay đổi tại màn hình này"
              leftIcon={<Mail className="w-4 h-4" />}
            />
          </div>

          <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-800">Đăng xuất phiên làm việc</p>
              <p className="text-[11px] text-stone-400">Kết thúc ca làm việc trên trình duyệt này</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Section 3: Note */}
        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300 flex items-start gap-2.5">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Đã kết nối Firestore:</strong> Thông tin cửa hàng và cấu hình hệ thống được đồng bộ thời gian thực tại document <code>settings/store</code> trên Cloud Firestore.
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="lg" rightIcon={<Check className="w-4 h-4" />}>
            Lưu cài đặt
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
