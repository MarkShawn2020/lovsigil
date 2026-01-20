'use client';

import type { UserProfile } from '@/providers/AuthProvider';
import { supabase } from './Supabase';

const API_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
}

/**
 * User data service for LovStudio schema (profiles + user_roles)
 * Uses RLS policies for security
 */
export class UserDataService {
  /**
   * Get user profile from profiles table
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        API_TIMEOUT_MS,
        'User profile request timed out'
      );

      if (error) {
        // No profile found - create default
        if (error.code === 'PGRST116') {
          return await this.createDefaultUserProfile(userId);
        }
        // Table doesn't exist - return default without saving
        if (error.message?.includes('Could not find the table') || error.code === '42P01') {
          return await this.getDefaultProfile(userId);
        }
        console.error('Error fetching user profile:', error.message);
        return null;
      }

      return this.mapDbProfileToUserProfile(data);
    } catch (error) {
      console.error('Unexpected error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Check if user has admin role
   */
  static async checkIsAdmin(userId: string): Promise<boolean> {
    try {
      const { data, error } = await withTimeout(
        supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle(),
        API_TIMEOUT_MS,
        'Admin check request timed out'
      );

      if (error) {
        // Table doesn't exist - not admin
        if (error.message?.includes('Could not find the table') || error.code === '42P01') {
          return false;
        }
        console.error('Error checking admin status:', error.message);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Unexpected error checking admin status:', error);
      return false;
    }
  }

  /**
   * Get complete user data (profile + admin status)
   */
  static async getUserData(userId: string): Promise<{
    profile: UserProfile | null;
    isAdmin: boolean;
  }> {
    try {
      const [profile, isAdmin] = await Promise.all([
        this.getUserProfile(userId),
        this.checkIsAdmin(userId),
      ]);

      return { profile, isAdmin };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { profile: null, isAdmin: false };
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const dbUpdates: any = {};

      if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
      if (updates.email !== undefined) dbUpdates.email = updates.email;

      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user profile:', error.message);
        return null;
      }

      return this.mapDbProfileToUserProfile(data);
    } catch (error) {
      console.error('Unexpected error updating user profile:', error);
      return null;
    }
  }

  /**
   * Create default user profile
   */
  private static async createDefaultUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user || user.id !== userId) {
        console.error('Error getting auth user for profile creation:', authError);
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user.email || null,
          display_name: user.user_metadata?.full_name || user.user_metadata?.display_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating default user profile:', error.message);
        return null;
      }

      return this.mapDbProfileToUserProfile(data);
    } catch (error) {
      console.error('Unexpected error creating default user profile:', error);
      return null;
    }
  }

  /**
   * Map database fields (snake_case) to TypeScript (camelCase)
   */
  private static mapDbProfileToUserProfile(dbData: any): UserProfile {
    return {
      id: dbData.id,
      email: dbData.email,
      displayName: dbData.display_name,
      avatarUrl: dbData.avatar_url,
      createdAt: new Date(dbData.created_at),
      updatedAt: new Date(dbData.updated_at),
    };
  }

  /**
   * Get default profile when table doesn't exist
   */
  private static async getDefaultProfile(userId: string): Promise<UserProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date();
    return {
      id: userId,
      email: user?.email || null,
      displayName: user?.user_metadata?.full_name || user?.user_metadata?.display_name || null,
      avatarUrl: user?.user_metadata?.avatar_url || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Subscribe to profile changes
   */
  static subscribeToUserProfile(userId: string, callback: (profile: UserProfile) => void) {
    return supabase
      .channel(`profile_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(this.mapDbProfileToUserProfile(payload.new));
          }
        }
      )
      .subscribe();
  }

  static unsubscribeFromUserProfile(subscription: any) {
    return supabase.removeChannel(subscription);
  }
}
