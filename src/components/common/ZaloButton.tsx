import React from 'react';
import { MessageCircle } from 'lucide-react';

/** Normalize VN phone to domestic 0-prefix so zalo.me links stay consistent. */
export function normalizeZaloPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('84') && digits.length > 10) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

interface ZaloButtonProps {
  phone?: string;
  zaloUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'outline' | 'subtle';
  className?: string;
  children?: React.ReactNode;
}

export function ZaloButton({
  phone,
  zaloUrl,
  size = 'md',
  variant = 'primary',
  className = '',
  children,
}: ZaloButtonProps) {
  // Phase 2 will construct real deep link: https://zalo.me/${phone} or custom link
  // TODO_PHASE_2_FIREBASE: Link to actual Zalo app deep link
  const href = phone ? `https://zalo.me/${normalizeZaloPhone(phone)}` : zaloUrl;
  const isConfigured = Boolean(href && href !== '#');

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 min-h-[32px]',
    md: 'text-sm px-3.5 py-2 gap-2 min-h-[40px]',
    lg: 'text-base px-4 py-2.5 gap-2.5 min-h-[44px]',
  };

  const variantClasses = {
    primary: 'bg-sky-500 hover:bg-sky-600 text-white shadow-xs focus:ring-sky-400',
    outline: 'border border-sky-300 text-sky-700 bg-sky-50/50 hover:bg-sky-100/70 focus:ring-sky-300',
    subtle: 'text-sky-600 hover:bg-sky-50 focus:ring-sky-200',
  };

  if (!isConfigured) {
    return (
      <span
        title="Chưa cấu hình Zalo của cửa hàng"
        className={`inline-flex items-center justify-center font-medium rounded-lg text-stone-400 bg-stone-50 border border-stone-200 cursor-not-allowed select-none ${sizeClasses[size]} ${className}`}
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        <span>{children || 'Zalo chưa cấu hình'}</span>
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Mở cuộc trò chuyện Zalo"
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-1 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      <MessageCircle className="w-4 h-4 shrink-0" />
      <span>{children || 'Nhắn Zalo'}</span>
    </a>
  );
}
