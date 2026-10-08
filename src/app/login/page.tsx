'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flower2, Lock, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('thungan@tiemhoa.vn');
  const [password, setPassword] = useState('••••••••');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Mock login simulation (no real Firebase auth yet)
    setTimeout(() => {
      router.push('/dashboard');
    }, 450);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-stone-50 to-pink-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-xl p-6 sm:p-8">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-white shadow-md mb-3">
            <Flower2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Tiệm Hoa</h1>
          <p className="text-sm text-stone-500 mt-1">Đăng nhập hệ thống quản lý đơn hàng</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            placeholder="nhanvien@tiemhoa.vn"
          />

          <Input
            label="Mật khẩu"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            placeholder="Nhập mật khẩu"
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Đăng nhập
            </Button>
          </div>
        </form>

        {/* Demo Helper Note */}
        <div className="mt-6 pt-5 border-t border-stone-100 text-center">
          <p className="text-xs text-stone-400">
            Hệ thống nội bộ V1 (Mock UI Scaffold) • Chưa kết nối Firebase Auth
          </p>
        </div>
      </div>
    </div>
  );
}
