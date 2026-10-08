'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark') ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
      localStorage.getItem('theme') === 'dark';
    
    document.documentElement.classList.toggle('dark', isDarkMode);
    // Wrap state setter in microtask or callback to avoid direct synchronous effect cascade
    const timer = setTimeout(() => {
      setIsDark(isDarkMode);
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  if (!mounted) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 dark:border-slate-700 dark:bg-slate-800 ${compact ? 'w-9 h-9' : 'gap-2 px-3 h-9 text-xs font-medium'}`}
      >
        <span className="w-4 h-4" />
        {!compact && <span>Giao diện</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
      className={`inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${compact ? 'w-9 h-9' : 'gap-2 px-3 h-9 text-xs font-medium'}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {!compact && <span>{isDark ? 'Sáng' : 'Tối'}</span>}
    </button>
  );
}