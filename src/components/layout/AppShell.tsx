'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { useAuth } from '@/components/auth/AuthProvider';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col antialiased text-[var(--foreground)]">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Top Header */}
      <MobileHeader />

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-20 lg:pb-8">
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}
