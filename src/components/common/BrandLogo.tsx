'use client';

import React, { useEffect, useState } from 'react';
import { Flower2 } from 'lucide-react';
import { getStoreLogoUrl } from '@/lib/services/settings';

interface BrandLogoProps {
  /** Custom logo URL. When omitted, falls back to the Flower2 mark. */
  src?: string;
  /** Box classes (size, rounding, background). Inherited rounding applies to the image. */
  boxClassName: string;
  iconClassName: string;
}

/** Shop logo with graceful fallback to the default flower mark. */
export function BrandLogo({ src, boxClassName, iconClassName }: BrandLogoProps) {
  if (src) {
    return (
      <div className={`${boxClassName} overflow-hidden`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Logo tiệm hoa" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${boxClassName} flex items-center justify-center text-white`}>
      <Flower2 className={iconClassName} />
    </div>
  );
}

/** Store logo URL, loaded once per session (empty string = not configured). */
export function useStoreLogo(): string {
  const [logoUrl, setLogoUrl] = useState('');
  useEffect(() => {
    let live = true;
    getStoreLogoUrl()
      .then((url) => {
        if (live) setLogoUrl(url);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return logoUrl;
}

/** Point the tab favicon at the store logo when one is configured. */
export function useDynamicFavicon() {
  useEffect(() => {
    getStoreLogoUrl()
      .then((url) => {
        if (!url || typeof document === 'undefined') return;
        let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        if (link.href !== url) link.href = url;
      })
      .catch(() => {});
  }, []);
}
