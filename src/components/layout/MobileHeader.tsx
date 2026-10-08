'use client';

import React from 'react';
import Link from 'next/link';
import { Flower2, Settings, User } from 'lucide-react';
import { mockCurrentUser } from '@/lib/mock';

export function MobileHeader() {
  return (
    <header className="lg:hidden sticky top-0 inset-x-0 h-14 bg-white border-b border-stone-200 z-30 px-4 flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center text-white">
          <Flower2 className="w-4 h-4" />
        </div>
        <span className="font-bold text-stone-900 text-sm">Tiệm Hoa</span>
      </Link>

      <div className="flex items-center gap-1.5">
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
          title={mockCurrentUser.name}
        >
          <User className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
