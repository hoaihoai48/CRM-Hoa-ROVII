'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Flower2, 
  Settings, 
  PlusCircle, 
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { getCurrentUser } from '@/lib/services';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/orders', label: 'Đơn hàng', icon: ShoppingBag },
  { href: '/customers', label: 'Khách hàng', icon: Users },
  { href: '/products', label: 'Sản phẩm', icon: Flower2 },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = React.useState<{ name: string; email: string } | null>(null);
  React.useEffect(() => { getCurrentUser().then(setUser); }, []);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-stone-200 z-30 dark:bg-slate-900 dark:border-slate-800">
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-stone-100 dark:border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <Flower2 className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-stone-900 text-base leading-tight block dark:text-white">Tiệm Hoa</span>
            <span className="text-[11px] text-stone-400 font-medium leading-none block mt-0.5">Quản lý đơn hàng</span>
          </div>
        </Link>
        <ThemeToggle compact />
      </div>

      {/* Quick Action */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href="/orders/new"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all hover:shadow"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tạo đơn mới</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-rose-50 text-rose-700 font-semibold'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-rose-600' : 'text-stone-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User / Footer */}
      <div className="p-3 border-t border-stone-100">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50/70 border border-stone-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-stone-900 truncate">{user?.name ?? "Đang tải..."}</p>
              <p className="text-[11px] text-stone-500 truncate">{user?.email ?? ""}</p>
            </div>
          </div>
          <Link
            href="/login"
            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded-lg transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
