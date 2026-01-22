'use client';

import { useLocale } from 'next-intl';
import { AppConfig } from '@/utils/AppConfig';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

const localeConfig: Record<string, { flag: string; name: string }> = {
  th: { flag: '🇹🇭', name: 'ไทย' },
  en: { flag: '🇬🇧', name: 'English' },
  ko: { flag: '🇰🇷', name: '한국어' },
  zh: { flag: '🇨🇳', name: '中文' },
};

interface LocaleSwitcherProps {
  className?: string;
}

export const LocaleSwitcher = ({ className }: LocaleSwitcherProps) => {
  const locale = useLocale();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === locale || isNavigating) return;
    setIsNavigating(true);

    // 设置 NEXT_LOCALE cookie
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;

    // 计算新 URL
    const currentPath = window.location.pathname;
    let basePath = currentPath;
    for (const loc of AppConfig.locales) {
      if (currentPath === `/${loc}` || currentPath.startsWith(`/${loc}/`)) {
        basePath = currentPath.slice(loc.length + 1) || '/';
        break;
      }
    }
    const isDefault = newLocale === AppConfig.defaultLocale;
    const newPath = isDefault ? basePath : `/${newLocale}${basePath === '/' ? '' : basePath}`;

    // 使用 location.replace 避免添加历史记录
    window.location.replace(newPath || '/');
  };

  const currentConfig = localeConfig[locale] ?? localeConfig.en!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex items-center gap-1 text-sm focus:outline-none disabled:opacity-50 ${className || ''}`}
        disabled={isNavigating}
      >
        <span className="text-base">{currentConfig.flag}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {AppConfig.locales.map((loc) => {
          const config = localeConfig[loc]!;
          const isActive = loc === locale;
          return (
            <DropdownMenuItem
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              className={`cursor-pointer ${isActive ? 'bg-accent' : ''}`}
            >
              <span className="text-base mr-2">{config.flag}</span>
              <span>{config.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
