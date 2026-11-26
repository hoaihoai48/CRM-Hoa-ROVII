'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Store, 
  User, 
  Phone, 
  MapPin, 
  Mail, 
  MessageCircle, 
  LogOut, 
  Check,
  ImagePlus,
  RefreshCw
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/common/Cards';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { getStoreSettings, updateStoreSettings } from '@/lib/services';
import { ImageUploader } from '@/components/common/ImageUploader';
import { useAuth } from '@/components/auth/AuthProvider';

function SettingsPageContent() {
  const router = useRouter();
  const { logout, membership: currentUser } = useAuth();

  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [zaloUrl, setZaloUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');


  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const loadRequestRef = useRef(0);
  const saveRequestRef = useRef(0);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEditSettings = currentUser?.role === 'admin' && currentUser.status === 'active';

  const loadSettings = useCallback(() => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    setErrorMessage(null);
    getStoreSettings()
      .then((settings) => {
        if (requestId !== loadRequestRef.current) return;
        setStoreName(settings.storeName);
        setStorePhone(settings.phone);
        setStoreAddress(settings.address);
        setZaloUrl(settings.zaloUrl);
        setLogoUrl(settings.logoUrl);
        setHasLoadedSettings(true);
      })
      .catch((error) => {
        if (requestId === loadRequestRef.current) {
          setErrorMessage(error instanceof Error ? error.message : 'Không thể tải cài đặt.');
        }
      })
      .finally(() => {
        if (requestId === loadRequestRef.current) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) loadSettings();
    });
    return () => {
      cancelled = true;
      loadRequestRef.current += 1;
      saveRequestRef.current += 1;
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings || !hasLoadedSettings || isSaving) return;
    const requestId = ++saveRequestRef.current;
    setErrorMessage(null);
    setIsSaved(false);
    setIsSaving(true);
    try {
      await updateStoreSettings({ storeName, phone: storePhone, address: storeAddress, zaloUrl, logoUrl: logoUrl.trim() });
      if (requestId !== saveRequestRef.current) return;
      setIsSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => {
        if (requestId === saveRequestRef.current) setIsSaved(false);
        savedTimeoutRef.current = null;
      }, 2500);
    } catch (error) {
      if (requestId === saveRequestRef.current) {
        setErrorMessage(error instanceof Error ? error.message : 'Không thể lưu cài đặt.');
      }
    } finally {
      if (requestId === saveRequestRef.current) setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setErrorMessage(null);
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể đăng xuất.');
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Cài đặt hệ thống"
        subtitle="Thông tin cửa hàng, tài khoản nhân viên và liên kết mạng xã hội"
        action={
          <button
            type="button"
            onClick={loadSettings}
            disabled={isLoading || isSaving}
            aria-label="Làm mới cài đặt"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Đang tải...' : 'Làm mới'}
          </button>
        }
      />

      {errorMessage && (
        <div role="alert" className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && !canEditSettings && (
        <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl">
          Tài khoản nhân viên chỉ được xem cài đặt. Chỉ quản trị viên đang hoạt động mới có quyền chỉnh sửa và lưu thông tin cửa hàng.
        </div>
      )}

      {!isLoading && !errorMessage && canEditSettings && (
        <div className="mb-6 p-3.5 bg-white border border-stone-200 text-xs rounded-xl flex items-center justify-between gap-3">
          <span className="text-stone-600">Quản lý tài khoản đăng nhập và phân quyền nhân viên.</span>
          <Link href="/staff" className="px-3 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shrink-0">
            Quản lý nhân viên →
          </Link>
        </div>
      )}

      {isLoading && <p role="status" className="mb-4 text-xs text-stone-500">Đang tải cài đặt...</p>}

      {isSaved && (
        <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Đã lưu cài đặt.</span>
        </div>
      )}

      {hasLoadedSettings && <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
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
              disabled={!canEditSettings || isLoading}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Số điện thoại hotline"
                type="tel"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                disabled={!canEditSettings || isLoading}
                leftIcon={<Phone className="w-4 h-4" />}
              />
              <Input
                label="Link Zalo OA / Zalo cá nhân của tiệm"
                value={zaloUrl}
                onChange={(e) => setZaloUrl(e.target.value)}
                disabled={!canEditSettings || isLoading}
                hint="Ví dụ: https://zalo.me/0909888999"
                leftIcon={<MessageCircle className="w-4 h-4" />}
              />
            </div>

            <Input
              label="Địa chỉ cửa hàng"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              disabled={!canEditSettings || isLoading}
              leftIcon={<MapPin className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Section 2: Shop Logo */}
        <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-2xs">
          <h2 className="text-base font-bold text-stone-900 pb-3 mb-4 border-b border-stone-100 flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-rose-500" />
            Logo tiệm
          </h2>
          <p className="text-[11px] text-stone-500 mb-3">
            Logo hiển thị ở sidebar, header, trang đăng nhập và favicon tab trình duyệt. Để trống để dùng biểu tượng hoa mặc định.
          </p>
          <ImageUploader
            label="Ảnh logo (vuông, nền trong suốt càng tốt)"
            currentImageUrl={logoUrl}
            onImageUploaded={(url) => setLogoUrl(url)}
            onImageRemoved={() => setLogoUrl('')}
            disabled={!canEditSettings || isLoading}
          />
        </div>

        {/* Section 3: Current Account */}
        <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-2xs">
          <h2 className="text-base font-bold text-stone-900 pb-3 mb-4 border-b border-stone-100 flex items-center gap-2">
            <User className="w-4 h-4 text-rose-500" />
            Tài khoản nhân viên đang đăng nhập
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tên nhân viên"
              value={currentUser?.name || ''}
              disabled
              hint="Tên hiển thị lấy từ hồ sơ nhân viên trong CRM; không thể thay đổi tại màn hình này"
            />
            <Input
              label="Email đăng nhập"
              type="email"
              value={currentUser?.email || ''}
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
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
            </button>
          </div>
        </div>

        {/* Action Button */}
        {canEditSettings && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading || isSaving || !hasLoadedSettings} variant="primary" size="lg" rightIcon={<Check className="w-4 h-4" />}>
              {isSaving ? "Đang lưu..." : "Lưu cài đặt"}
            </Button>
          </div>
        )}
      </form>}
      {!hasLoadedSettings && !isLoading && errorMessage && (
        <p className="mb-6 text-xs text-stone-500">Chưa thể hiển thị biểu mẫu vì dữ liệu cài đặt chưa tải thành công. Hãy thử tải lại trước khi chỉnh sửa.</p>
      )}
    
    </>
  );
}


export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsPageContent />
    </AppShell>
  );
}
