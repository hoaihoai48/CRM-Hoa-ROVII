import React from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Truck, 
  XCircle 
} from 'lucide-react';
import { OrderStatus } from '@/types';

import { THEME_CONFIG } from '@/lib/constants/theme';

interface StatusConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  dotClass: string;
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  new: {
    label: THEME_CONFIG.statusColors.new.label,
    icon: Sparkles,
    badgeClass: `${THEME_CONFIG.statusColors.new.bgLight} ${THEME_CONFIG.statusColors.new.textLight} ${THEME_CONFIG.statusColors.new.borderLight} ${THEME_CONFIG.statusColors.new.bgDark} ${THEME_CONFIG.statusColors.new.textDark}`,
    dotClass: THEME_CONFIG.statusColors.new.dot,
  },
  confirmed: {
    label: THEME_CONFIG.statusColors.confirmed.label,
    icon: Clock,
    badgeClass: `${THEME_CONFIG.statusColors.confirmed.bgLight} ${THEME_CONFIG.statusColors.confirmed.textLight} ${THEME_CONFIG.statusColors.confirmed.borderLight} ${THEME_CONFIG.statusColors.confirmed.bgDark} ${THEME_CONFIG.statusColors.confirmed.textDark}`,
    dotClass: THEME_CONFIG.statusColors.confirmed.dot,
  },
  delivering: {
    label: THEME_CONFIG.statusColors.delivering.label,
    icon: Truck,
    badgeClass: `${THEME_CONFIG.statusColors.delivering.bgLight} ${THEME_CONFIG.statusColors.delivering.textLight} ${THEME_CONFIG.statusColors.delivering.borderLight} ${THEME_CONFIG.statusColors.delivering.bgDark} ${THEME_CONFIG.statusColors.delivering.textDark}`,
    dotClass: THEME_CONFIG.statusColors.delivering.dot,
  },
  completed: {
    label: THEME_CONFIG.statusColors.completed.label,
    icon: CheckCircle2,
    badgeClass: `${THEME_CONFIG.statusColors.completed.bgLight} ${THEME_CONFIG.statusColors.completed.textLight} ${THEME_CONFIG.statusColors.completed.borderLight} ${THEME_CONFIG.statusColors.completed.bgDark} ${THEME_CONFIG.statusColors.completed.textDark}`,
    dotClass: THEME_CONFIG.statusColors.completed.dot,
  },
  cancelled: {
    label: THEME_CONFIG.statusColors.cancelled.label,
    icon: XCircle,
    badgeClass: `${THEME_CONFIG.statusColors.cancelled.bgLight} ${THEME_CONFIG.statusColors.cancelled.textLight} ${THEME_CONFIG.statusColors.cancelled.borderLight} ${THEME_CONFIG.statusColors.cancelled.bgDark} ${THEME_CONFIG.statusColors.cancelled.textDark}`,
    dotClass: THEME_CONFIG.statusColors.cancelled.dot,
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
