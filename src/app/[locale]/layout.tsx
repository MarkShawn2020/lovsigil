import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Fira_Code, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { routing } from '@/libs/I18nRouting';
import { AuthProvider } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';
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

// Viewport configuration for mobile optimization
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F9F7' },
    { media: '(prefers-color-scheme: dark)', color: '#141413' },
  ],
};

// Base metadata configuration - specific metadata will be generated per locale
export const generateMetadata = async (props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> => {
  const { locale } = await props.params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lovsigil.lovstudio.ai';

  // Locale-specific metadata
  const metadataByLocale = {
    zh: {
      title: {
        default: 'LovSigil - AI 个人符文图腾生成器',
        template: '%s | LovSigil',
      },
      description: '基于 AI 面部分析的个人符文图腾生成器。通过面部特征分析你的内在本质，生成专属的卢恩风格 Sigil 图腾。',
      keywords: ['Sigil', '符文', 'AI', '面部分析', '图腾', '个性化', '卢恩', '神秘'],
      ogLocale: 'zh_CN',
      ogTitle: 'LovSigil - AI 个人符文图腾生成器',
      ogDescription: '基于 AI 面部分析，生成专属于你的卢恩风格 Sigil 图腾。',
      twitterTitle: 'LovSigil - AI 个人符文图腾生成器',
      twitterDescription: '基于 AI 面部分析的个人符文图腾生成器。',
      ogImageAlt: 'LovSigil - AI Sigil Generator',
    },
    en: {
      title: {
        default: 'LovSigil - AI Personal Sigil Totem Generator',
        template: '%s | LovSigil',
      },
      description: 'AI-powered personal Sigil totem generator. Analyze your inner essence through facial features and create unique rune-style Sigil totems.',
      keywords: ['Sigil', 'rune', 'AI', 'facial analysis', 'totem', 'personalization', 'mystic', 'generator'],
      ogLocale: 'en_US',
      ogTitle: 'LovSigil - AI Personal Sigil Totem Generator',
      ogDescription: 'AI-powered personal Sigil totem generator with face detection and rune-style personalization.',
      twitterTitle: 'LovSigil - AI Personal Sigil Totem Generator',
      twitterDescription: 'Generate unique rune-style Sigil totems based on your inner essence.',
      ogImageAlt: 'LovSigil - AI Sigil Generator',
    },
  };

  const currentMetadata = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;

  return {
    title: currentMetadata.title,
    description: currentMetadata.description,
    keywords: currentMetadata.keywords,
    authors: [{ name: 'LovStudio' }],
    creator: 'LovStudio',
    publisher: 'LovStudio',
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
      siteName: 'LovSigil',
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
      site: '@lovstudio_ai',
      creator: '@lovstudio_ai',
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
    <html lang={locale} className={`dark ${inter.variable} ${firaCode.variable}`}>
      <head>
        {/* Preconnect to critical third-party origins for faster resource loading */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://storage.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://storage.googleapis.com" />
        {/* iOS PWA optimizations */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LovSigil" />
        {/* Prevent phone number detection on mobile */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <PostHogProvider>
            <ToastProvider>
              <QueryProvider>
                <AuthProvider>
                  {props.children}
                </AuthProvider>
              </QueryProvider>
            </ToastProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
