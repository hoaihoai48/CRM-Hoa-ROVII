'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { useAuth } from '@/components/auth/AuthProvider';

interface AppShellProps { children: React.ReactNode; }

export function AppShell({ children }: AppShellProps) {
  const {
    user, loading, logout, membership, membershipUserId,
    membershipLoading, membershipError, retryMembership,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-stone-500 font-medium">Đang khôi phục phiên đăng nhập...</p>
      </div>
    </div>
  );
  if (!user) return null;

  // The route content is not mounted until the current UID has been verified.
  if (membershipLoading || membershipUserId !== user.uid) return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-stone-500 font-medium">Đang xác minh tài khoản nhân viên...</p>
      </div>
    </div>
  );

  if (membershipError) return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
      <div role="alert" className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-stone-900">Chưa xác minh được quyền truy cập</h1>
        <p className="mt-2 text-sm text-stone-600">Không thể kiểm tra hồ sơ nhân viên do lỗi kết nối hoặc Firebase. Điều này chưa có nghĩa tài khoản bị từ chối quyền.</p>
        <p className="mt-2 break-words text-xs text-stone-500">{membershipError}</p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" onClick={retryMembership} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Thử lại</button>
          <button type="button" onClick={() => logout().then(() => router.replace('/login'))} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white">Đăng xuất</button>
        </div>
      </div>
    </div>
  );

  if (!membership || membership.status !== 'active' || !['admin', 'staff'].includes(membership.role)) return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-stone-900">Tài khoản chưa được cấp quyền</h1>
        <p className="mt-2 text-sm text-stone-600">Tài khoản đã đăng nhập nhưng chưa có hồ sơ nhân viên hợp lệ hoặc đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.</p>
        <button type="button" onClick={() => logout().then(() => router.replace('/login'))} className="mt-5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white">Đăng xuất</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col antialiased text-[var(--foreground)]">
      <Sidebar />
      <MobileHeader />
      <main className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-20 lg:pb-8">
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
