import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 min-h-[36px] rounded-md',
    md: 'text-sm px-3.5 py-2 gap-2 min-h-[42px] rounded-lg',
    lg: 'text-base px-5 py-2.5 gap-2.5 min-h-[48px] rounded-lg',
  };

  const variantClasses = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs focus:ring-emerald-500',
    secondary: 'bg-rose-500 hover:bg-rose-600 text-white font-medium shadow-xs focus:ring-rose-400',
    outline: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 font-medium focus:ring-stone-400',
    danger: 'bg-red-600 hover:bg-red-700 text-white font-medium shadow-xs focus:ring-red-500',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 font-medium focus:ring-stone-300',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
}
