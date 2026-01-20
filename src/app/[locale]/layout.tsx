import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Fira_Code, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { routing } from '@/libs/I18nRouting';
import { AuthProvider } from '@/providers/AuthProvider';
import '@/styles/global.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

// Base metadata configuration - specific metadata will be generated per locale
export const generateMetadata = async (props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> => {
  const { locale } = await props.params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lanna-mirror-3.ai';

  // Locale-specific metadata
  const metadataByLocale = {
    zh: {
      title: {
        default: '兰纳照妖镜 - 发现你的守护灵',
        template: '%s | 兰纳照妖镜',
      },
      description: '基于 AI 面部表情分析的兰纳守护灵匹配系统。照见你的那伽、狮子、天鹅、大象或金翅鸟守护灵。',
      keywords: ['兰纳', '守护灵', 'AI', '面部分析', '那伽', '狮子', '天鹅', '大象', '金翅鸟', '泰北文化'],
      ogLocale: 'zh_CN',
      ogTitle: '兰纳照妖镜 - 发现你的守护灵',
      ogDescription: '基于 AI 面部表情分析，发现属于你的兰纳五大守护灵。',
      twitterTitle: '兰纳照妖镜 - 发现你的守护灵',
      twitterDescription: '基于 AI 面部表情分析的兰纳守护灵匹配系统。',
      ogImageAlt: '兰纳照妖镜 - Lanna Spirit Mirror',
    },
    en: {
      title: {
        default: 'Lanna Spirit Mirror - Discover Your Guardian Spirit',
        template: '%s | Lanna Spirit Mirror',
      },
      description: 'AI-powered facial expression analysis to match your Lanna guardian spirit. Discover your Naga, Singha, Hong, Chang, or Garuda protector.',
      keywords: ['Lanna', 'guardian spirit', 'AI', 'facial analysis', 'Naga', 'Singha', 'Hong', 'Chang', 'Garuda', 'Thai culture'],
      ogLocale: 'en_US',
      ogTitle: 'Lanna Spirit Mirror - Discover Your Guardian Spirit',
      ogDescription: 'AI-powered facial expression analysis to discover your Lanna guardian spirit.',
      twitterTitle: 'Lanna Spirit Mirror - Discover Your Guardian Spirit',
      twitterDescription: 'AI-powered Lanna guardian spirit matching through facial expression analysis.',
      ogImageAlt: 'Lanna Spirit Mirror',
    },
  };

  const currentMetadata = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;

  return {
    title: currentMetadata.title,
    description: currentMetadata.description,
    keywords: currentMetadata.keywords,
    authors: [{ name: 'LannaMirror3 Technology' }],
    creator: 'LannaMirror3 Technology',
    publisher: 'LannaMirror3 Technology',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'zh-CN': `${baseUrl}/zh`,
        'en-US': `${baseUrl}/en`,
        'x-default': `${baseUrl}/en`,
      },
    },
    openGraph: {
      type: 'website',
      locale: currentMetadata.ogLocale,
      alternateLocale: locale === 'zh' ? 'en_US' : 'zh_CN',
      url: `/${locale}`,
      title: currentMetadata.ogTitle,
      description: currentMetadata.ogDescription,
      siteName: 'LannaMirror3',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: currentMetadata.ogImageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@lanna-mirror-3_ai',
      creator: '@lanna-mirror-3_ai',
      title: currentMetadata.twitterTitle,
      description: currentMetadata.twitterDescription,
      images: ['/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        'index': true,
        'follow': true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      yandex: process.env.YANDEX_VERIFICATION,
      yahoo: process.env.YAHOO_SITE_VERIFICATION,
    },
    icons: [
      {
        rel: 'apple-touch-icon',
        url: '/apple-touch-icon.png',
        sizes: '180x180',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        url: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        url: '/favicon-16x16.png',
      },
      {
        rel: 'icon',
        url: '/favicon.ico',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        url: '/favicon.svg',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        url: '/icon-192x192.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        url: '/icon-512x512.png',
      },
    ],
    manifest: '/manifest.json',
  };
};

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${inter.variable} ${firaCode.variable}`}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <PostHogProvider>
            <ToastProvider>
              <AuthProvider>
                {props.children}
              </AuthProvider>
            </ToastProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
