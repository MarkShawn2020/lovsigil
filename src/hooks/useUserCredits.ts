'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/libs/Supabase'
import { useAuth } from '@/providers/AuthProvider'

export interface UserCredits {
  id: string
  user_id: string
  balance: number
  total_purchased: number
  total_bonus: number
  total_spent: number
  created_at: string
  updated_at: string
}

export interface CreditPackage {
  id: string
  name: string
  description: string | null
  price_cents: number
  base_credits: number
  bonus_credits: number
  is_popular: boolean
  is_active: boolean
  display_order: number
}

export interface CreditTransaction {
  id: string
  user_id: string
  type: 'purchase' | 'bonus' | 'spend' | 'refund' | 'admin_adjust'
  amount: number
  balance_after: number
  description: string | null
  reference_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export const useUserCredits = () => {
  const { user } = useAuth()
  const [credits, setCredits] = useState<UserCredits | null>(null)
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCredits = useCallback(async () => {
    if (!user) {
      setCredits(null)
      setIsLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching credits:', error)
    }

    setCredits(data || null)
    setIsLoading(false)
  }, [user])

  const fetchPackages = useCallback(async () => {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching packages:', error)
      return
    }

    setPackages(data || [])
  }, [])

  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([])
      return
    }

    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching transactions:', error)
      return
    }

    setTransactions(data || [])
  }, [user])

  useEffect(() => {
    fetchCredits()
    fetchPackages()
  }, [fetchCredits, fetchPackages])

  // Realtime subscription for credits updates
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`user-credits-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setCredits(payload.new as UserCredits)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // Start polling for credits (fallback when realtime fails)
  const startPolling = useCallback(() => {
    if (pollingRef.current) return
    pollingRef.current = setInterval(fetchCredits, 3000)
  }, [fetchCredits])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const createCheckoutSession = useCallback(
    async (packageId: string) => {
      if (!user) {
        throw new Error('Must be logged in to purchase credits')
      }

      setIsCheckoutLoading(true)

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token

        if (!token) {
          throw new Error('No auth token')
        }

        const response = await supabase.functions.invoke('create-checkout-session', {
          body: {
            packageId,
            successUrl: `${window.location.origin}/credits?success=true`,
            cancelUrl: `${window.location.origin}/credits?canceled=true`,
          },
        })

        if (response.error) {
          throw new Error(response.error.message || 'Failed to create checkout session')
        }

        const { url } = response.data

        if (url) {
          window.location.href = url
        }
      } finally {
        setIsCheckoutLoading(false)
      }
    },
    [user]
  )

  const refetch = useCallback(() => {
    fetchCredits()
    fetchTransactions()
  }, [fetchCredits, fetchTransactions])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  return {
    credits,
    balance: credits?.balance ?? 0,
    packages,
    transactions,
    isLoading,
    isCheckoutLoading,
    createCheckoutSession,
    fetchTransactions,
    refetch,
    startPolling,
    stopPolling,
  }
}
