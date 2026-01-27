'use client'

import { ArrowLeft, Coins, History, Package, Sparkles, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'

import { CreditPackage, CreditTransaction, useUserCredits } from '@/hooks/useUserCredits'

export function CreditsPageContent() {
  const t = useTranslations('Credits')
  const { user, loading: authLoading } = useAuth()
  const {
    credits,
    balance,
    packages,
    transactions,
    isLoading,
    isCheckoutLoading,
    createCheckoutSession,
    fetchTransactions,
  } = useUserCredits()

  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (activeTab === 'history') {
      fetchTransactions()
    }
  }, [activeTab, fetchTransactions])

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-white/60">
          <p>{t('login_required')}</p>
          <Link href="/" className="text-primary hover:underline mt-2 inline-block">
            {t('back_home')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white/60 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              {t('title')}
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Wallet className="w-4 h-4 mr-1.5" />
              {t('tab_overview')}
            </TabsTrigger>
            <TabsTrigger value="recharge" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Package className="w-4 h-4 mr-1.5" />
              {t('tab_recharge')}
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <History className="w-4 h-4 mr-1.5" />
              {t('tab_history')}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl p-6 border border-primary/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">{t('current_balance')}</p>
                  <p className="text-4xl font-bold text-primary mt-1">{balance}</p>
                  <p className="text-white/40 text-xs mt-1">{t('credits_unit')}</p>
                </div>
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Coins className="w-8 h-8 text-primary" />
                </div>
              </div>
            </div>

            {/* Stats */}
            {credits && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/40 text-xs">{t('total_purchased')}</p>
                  <p className="text-xl font-semibold text-white mt-1">{credits.total_purchased}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/40 text-xs">{t('total_bonus')}</p>
                  <p className="text-xl font-semibold text-green-400 mt-1">+{credits.total_bonus}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/40 text-xs">{t('total_spent')}</p>
                  <p className="text-xl font-semibold text-orange-400 mt-1">-{credits.total_spent}</p>
                </div>
              </div>
            )}

            {/* Quick Recharge */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{t('need_more')}</p>
                  <p className="text-white/40 text-sm">{t('need_more_desc')}</p>
                </div>
                <Button
                  onClick={() => setActiveTab('recharge')}
                  className="gradient-gold-copper hover:brightness-110"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {t('recharge_now')}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Recharge Tab */}
          <TabsContent value="recharge" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  isLoading={isCheckoutLoading}
                  onPurchase={() => createCheckoutSession(pkg.id)}
                />
              ))}
            </div>

            {packages.length === 0 && (
              <div className="text-center py-12 text-white/40">
                {t('no_packages')}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                {t('no_transactions')}
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function PackageCard({
  pkg,
  isLoading,
  onPurchase,
}: {
  pkg: CreditPackage
  isLoading: boolean
  onPurchase: () => void
}) {
  const t = useTranslations('Credits')
  const totalCredits = pkg.base_credits + pkg.bonus_credits
  const priceFormatted = (pkg.price_cents / 100).toFixed(0)

  return (
    <div
      className={cn(
        'relative bg-white/5 rounded-xl p-5 border transition-all',
        pkg.is_popular
          ? 'border-primary ring-1 ring-primary/30'
          : 'border-white/10 hover:border-white/20'
      )}
    >
      {pkg.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-black text-xs font-medium rounded-full">
          {t('popular')}
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{pkg.name}</h3>
          {pkg.description && (
            <p className="text-white/40 text-sm mt-1">{pkg.description}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{t('price_format', { price: priceFormatted })}</p>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-bold text-white">{totalCredits}</span>
        <span className="text-white/40 text-sm">{t('credits_unit')}</span>
        {pkg.bonus_credits > 0 && (
          <span className="text-green-400 text-sm">
            (+{pkg.bonus_credits} {t('bonus')})
          </span>
        )}
      </div>

      <Button
        onClick={onPurchase}
        disabled={isLoading}
        className={cn(
          'w-full',
          pkg.is_popular
            ? 'gradient-gold-copper hover:brightness-110'
            : 'bg-white/10 hover:bg-white/20'
        )}
      >
        {isLoading ? t('processing') : t('purchase')}
      </Button>
    </div>
  )
}

function TransactionItem({ transaction }: { transaction: CreditTransaction }) {
  const t = useTranslations('Credits')
  const locale = useLocale()
  const isPositive = ['purchase', 'bonus', 'refund'].includes(transaction.type)

  const typeLabels: Record<string, string> = {
    purchase: t('type_purchase'),
    bonus: t('type_bonus'),
    spend: t('type_spend'),
    refund: t('type_refund'),
    admin_adjust: t('type_adjust'),
  }

  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US'

  return (
    <div className="flex items-center justify-between bg-white/5 rounded-lg p-4 border border-white/10">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            isPositive ? 'bg-green-500/20' : 'bg-orange-500/20'
          )}
        >
          <Coins className={cn('w-4 h-4', isPositive ? 'text-green-400' : 'text-orange-400')} />
        </div>
        <div>
          <p className="text-white text-sm font-medium">
            {typeLabels[transaction.type] || transaction.type}
          </p>
          {transaction.description && (
            <p className="text-white/40 text-xs">{transaction.description}</p>
          )}
          <p className="text-white/30 text-xs">
            {new Date(transaction.created_at).toLocaleString(dateLocale)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn('font-semibold', isPositive ? 'text-green-400' : 'text-orange-400')}>
          {isPositive ? '+' : ''}{transaction.amount}
        </p>
        <p className="text-white/40 text-xs">
          {t('balance_after')}: {transaction.balance_after}
        </p>
      </div>
    </div>
  )
}
