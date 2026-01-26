import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CreditsPageContent } from '@/components/credits/CreditsPageContent';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Credits' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default function CreditsPage() {
  return <CreditsPageContent />;
}
