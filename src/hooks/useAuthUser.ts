'use client';

import { useAuth } from '@/providers/AuthProvider';

/**
 * Hook to get the current authenticated user
 */
export function useAuthUser() {
  const { user, loading, isAdmin } = useAuth();

  return {
    user,
    loading,
    isAuthenticated: !!user,
    profile: user?.profile,
    isAdmin,
  };
}

/**
 * Hook for authentication actions
 */
export function useAuthActions() {
  const { signIn, signInWithGoogle, signUp, signOut, resetPassword, updateProfile, refreshUser } = useAuth();

  return {
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    refreshUser,
  };
}

/**
 * Hook to check admin status
 */
export function useAdminStatus() {
  const { user, isAdmin } = useAuth();

  return {
    isAdmin,
    userId: user?.id,
  };
}
