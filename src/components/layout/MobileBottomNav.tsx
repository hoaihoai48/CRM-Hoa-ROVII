'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Flower2, 
  PlusCircle 
} from 'lucide-react';

const MOBILE_NAV_ITEMS = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/orders', label: 'Đơn hàng', icon: ShoppingBag },
  { href: '/orders/new', label: 'Tạo đơn', icon: PlusCircle, isHighlight: true },
  { href: '/customers', label: 'Khách', icon: Users },
  { href: '/products', label: 'Sản phẩm', icon: Flower2 },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 z-40 pb-safe shadow-lg">
      <div className="grid grid-cols-5 h-16 items-center px-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/orders/new' && pathname.startsWith(item.href));
          const Icon = item.icon;

          if (item.isHighlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-4 group"
              >
                <div className="w-12 h-12 rounded-full bg-brand text-brand-text flex items-center justify-center shadow-md group-active:scale-95 transition-transform border-2 border-white dark:border-stone-900">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-semibold text-brand mt-0.5">Tạo đơn</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                isActive ? 'text-rose-600 font-semibold' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
