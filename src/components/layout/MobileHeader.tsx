'use client';

import React from 'react';
import Link from 'next/link';
import { Flower2, Settings, User } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/components/auth/AuthProvider';

export function MobileHeader() {
  const { user: firebaseUser } = useAuth();
  const userName = firebaseUser?.displayName || firebaseUser?.phoneNumber || firebaseUser?.email || 'Tài khoản';

  return (
    <header className="lg:hidden sticky top-0 inset-x-0 h-14 bg-white border-b border-stone-200 z-30 dark:bg-slate-900 dark:border-slate-800 px-4 flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center text-white">
          <Flower2 className="w-4 h-4" />
        </div>
        <span className="font-bold text-stone-900 text-sm">Tiệm Hoa</span>
      </Link>

      <div className="flex items-center gap-1.5">
        <ThemeToggle compact />
        <Link
          href="/settings"
          className="p-2 text-stone-500 hover:text-stone-900 rounded-lg"
          title="Cài đặt"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <Link
          href="/settings"
          className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs"
          title={userName}
        >
          <User className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
