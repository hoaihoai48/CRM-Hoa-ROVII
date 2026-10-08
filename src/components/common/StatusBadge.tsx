import React from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Truck, 
  XCircle 
} from 'lucide-react';
import { OrderStatus } from '@/types';

interface StatusConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  dotClass: string;
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  new: {
    label: 'Mới',
    icon: Sparkles,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    dotClass: 'bg-emerald-500',
  },
  confirmed: {
    label: 'Đã xác nhận',
    icon: Clock,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/70',
    dotClass: 'bg-blue-500',
  },
  delivering: {
    label: 'Đang giao',
    icon: Truck,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/70',
    dotClass: 'bg-amber-500',
  },
  completed: {
    label: 'Hoàn tất',
    icon: CheckCircle2,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
    dotClass: 'bg-rose-500',
  },
  cancelled: {
    label: 'Đã hủy',
    icon: XCircle,
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
    dotClass: 'bg-stone-400',
  },
};

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className = '',
}: StatusBadgeProps) {
  const config = ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.new;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.badgeClass} ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <Icon className={`${iconSizes[size]} shrink-0`} />}
      <span>{config.label}</span>
    </span>
  );
}
