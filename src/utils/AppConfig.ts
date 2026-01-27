import type { LocalePrefixMode } from 'next-intl/routing';

const localePrefix: LocalePrefixMode = 'as-needed';

// Helper function to detect user's preferred language
export const detectUserLocale = (acceptLanguage?: string | null): string => {
  if (!acceptLanguage) {
    return 'th';
  }

  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(',')
    .map(lang => lang.split(';')[0]?.trim().toLowerCase())
    .filter(Boolean);

  // Check for supported languages in order of priority
  for (const lang of languages) {
    if (lang?.startsWith('th'))
      return 'th';
    if (lang?.startsWith('ko'))
      return 'ko';
    if (lang?.startsWith('zh') || lang?.includes('chinese'))
      return 'zh';
    if (lang?.startsWith('en'))
      return 'en';
  }

  return 'th';
};

export const AppConfig = {
  name: 'LovSigil',
  locales: ['th', 'en', 'ko', 'zh'],
  defaultLocale: 'en',
  localePrefix,
};
