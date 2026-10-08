import React from 'react';
import { Search } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-stone-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-2xs">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`block w-full rounded-lg border text-sm text-stone-900 placeholder:text-stone-400 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[42px] px-3.5 py-2 ${
            leftIcon ? 'pl-10' : ''
          } ${
            error
              ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
              : 'border-stone-300 hover:border-stone-400'
          } ${className}`}
          {...props}
        />
      </div>
      {hint && !error && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onSearchChange?: (val: string) => void;
}

export function SearchInput({ className = '', placeholder = 'Tìm kiếm...', ...props }: SearchInputProps) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="search"
        placeholder={placeholder}
        className={`block w-full pl-9 pr-4 py-2 text-sm bg-white border border-stone-300 rounded-lg placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[42px] ${className}`}
        {...props}
      />
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  label,
  error,
  hint,
  className = '',
  id,
  rows = 3,
  ...props
}: TextareaProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-stone-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={`block w-full rounded-lg border text-sm text-stone-900 placeholder:text-stone-400 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 px-3.5 py-2.5 ${
          error
            ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
            : 'border-stone-300 hover:border-stone-400'
        } ${className}`}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}
