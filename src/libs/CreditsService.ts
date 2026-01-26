'use client';

import { supabase } from './Supabase';

export interface UserCredits {
  id: string;
  userId: string;
  balance: number;
  totalPurchased: number;
  totalBonus: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  type: 'purchase' | 'bonus' | 'spend' | 'refund' | 'admin_adjust';
  amount: number;
  balanceAfter: number;
  description: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const API_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
}

export class CreditsService {
  /**
   * Get user credits balance
   */
  static async getUserCredits(userId: string): Promise<UserCredits | null> {
    try {
      const { data, error } = await withTimeout(
        supabase.from('user_credits').select('*').eq('user_id', userId).single(),
        API_TIMEOUT_MS,
        'User credits request timed out'
      );

      if (error) {
        if (error.code === 'PGRST116') {
          // No credits record - create default with 0 balance
          return await this.createDefaultUserCredits(userId);
        }
        console.error('Error fetching user credits:', error.message);
        return null;
      }

      return this.mapDbCreditsToUserCredits(data);
    } catch (error) {
      console.error('Unexpected error fetching user credits:', error);
      return null;
    }
  }

  /**
   * Spend credits for generation
   * @param userId User ID
   * @param amount Amount of credits to spend (positive number)
   * @param description Description of the spend
   * @param referenceId Optional reference ID (e.g., order_id)
   * @returns Updated balance or null if failed
   */
  static async spendCredits(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string
  ): Promise<{ success: boolean; balance?: number; error?: string }> {
    try {
      // Get current balance
      const credits = await this.getUserCredits(userId);
      if (!credits) {
        return { success: false, error: 'Failed to get credits balance' };
      }

      if (credits.balance < amount) {
        return { success: false, error: 'Insufficient credits', balance: credits.balance };
      }

      const newBalance = credits.balance - amount;

      // Update balance
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          balance: newBalance,
          total_spent: credits.totalSpent + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating credits balance:', updateError.message);
        return { success: false, error: 'Failed to update credits balance' };
      }

      // Record transaction
      const { error: txError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          type: 'spend',
          amount: -amount,
          balance_after: newBalance,
          description,
          reference_id: referenceId || null,
          metadata: {},
        });

      if (txError) {
        console.error('Error recording transaction:', txError.message);
        // Don't fail the operation, just log the error
      }

      return { success: true, balance: newBalance };
    } catch (error) {
      console.error('Unexpected error spending credits:', error);
      return { success: false, error: 'Unexpected error' };
    }
  }

  /**
   * Check if user has enough credits
   */
  static async hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    const credits = await this.getUserCredits(userId);
    return credits ? credits.balance >= amount : false;
  }

  /**
   * Create default user credits record
   */
  private static async createDefaultUserCredits(userId: string): Promise<UserCredits | null> {
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          balance: 0,
          total_purchased: 0,
          total_bonus: 0,
          total_spent: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating default user credits:', error.message);
        return null;
      }

      return this.mapDbCreditsToUserCredits(data);
    } catch (error) {
      console.error('Unexpected error creating default user credits:', error);
      return null;
    }
  }

  /**
   * Map database fields (snake_case) to TypeScript (camelCase)
   */
  private static mapDbCreditsToUserCredits(dbData: any): UserCredits {
    return {
      id: dbData.id,
      userId: dbData.user_id,
      balance: dbData.balance,
      totalPurchased: dbData.total_purchased,
      totalBonus: dbData.total_bonus,
      totalSpent: dbData.total_spent,
      createdAt: new Date(dbData.created_at),
      updatedAt: new Date(dbData.updated_at),
    };
  }

  /**
   * Subscribe to credits changes
   */
  static subscribeToUserCredits(userId: string, callback: (credits: UserCredits) => void) {
    return supabase
      .channel(`credits_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(this.mapDbCreditsToUserCredits(payload.new));
          }
        }
      )
      .subscribe();
  }

  static unsubscribeFromUserCredits(subscription: any) {
    return supabase.removeChannel(subscription);
  }
}
