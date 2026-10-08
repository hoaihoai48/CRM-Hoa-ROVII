import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  action,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 ${className}`}>
      <div className="flex items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="p-2 -ml-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors inline-flex items-center justify-center shrink-0 min-w-[36px] min-h-[36px]"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-emerald-50 text-emerald-700',
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-2xs hover:border-stone-300 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-medium text-stone-500">{title}</span>
        <div className={`p-2 sm:p-2.5 rounded-lg ${iconBgColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-xl sm:text-2xl font-bold text-stone-900 tabular-nums">{value}</div>
        {subtitle && <p className="text-xs text-stone-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white rounded-xl border border-dashed border-stone-200">
      {Icon && (
        <div className="p-3 bg-stone-100 text-stone-400 rounded-full mb-3">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-stone-800">{title}</h3>
      {description && <p className="text-xs sm:text-sm text-stone-500 max-w-sm mt-1 mb-4">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
