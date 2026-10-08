import React from 'react';
import { formatVND } from '@/lib/utils/format';

interface MoneyDisplayProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isNegative?: boolean;
}

export function MoneyDisplay({
  amount,
  size = 'md',
  className = '',
  isNegative = false,
}: MoneyDisplayProps) {
  const sizeClasses = {
    sm: 'text-xs font-medium',
    md: 'text-sm font-semibold',
    lg: 'text-base font-bold',
    xl: 'text-xl font-bold tracking-tight',
  };

  const formatted = formatVND(Math.abs(amount));

  return (
    <span className={`tabular-nums ${sizeClasses[size]} ${className}`}>
      {isNegative ? `-${formatted}` : formatted}
    </span>
  );
}
