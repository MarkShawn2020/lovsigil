'use client';

import type { User } from '@supabase/supabase-js';
import React, { createContext, use, useEffect, useReducer, useRef } from 'react';
import { AuthClientService } from '@/libs/AuthClient';
import { CreditsService, type UserCredits } from '@/libs/CreditsService';
import { supabase } from '@/libs/Supabase';
import { UserDataService } from '@/libs/UserDataService';

// Types - adapted for LovStudio schema (profiles + user_roles)
export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AppRole = 'admin' | 'user';

export type AuthUser = {
  profile?: UserProfile;
  credits?: UserCredits;
  isAdmin: boolean;
} & User;

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
};

export type AuthContextType = {
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName?: string, options?: { redirectTo?: string }) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<{ error?: string }>;
  refreshUser: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  spendCredits: (amount: number, description: string, referenceId?: string) => Promise<{ success: boolean; balance?: number; error?: string }>;
  isAdmin: boolean;
  credits: number;
} & AuthState;

type AuthAction
  = | { type: 'SIGN_IN_START' }
    | { type: 'SIGN_IN_SUCCESS'; payload: AuthUser }
    | { type: 'SIGN_IN_ERROR'; payload: string }
    | { type: 'SIGN_OUT' }
    | { type: 'UPDATE_USER'; payload: AuthUser }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to get cached auth state
function getCachedAuthState(): Partial<AuthState> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const cached = sessionStorage.getItem('auth-state');
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        user: parsed.user || null,
      };
    }
  } catch (error) {
    console.warn('Failed to parse cached auth state:', error);
    try {
      sessionStorage.removeItem('auth-state');
    } catch (clearError) {
      console.warn('Failed to clear corrupted auth cache:', clearError);
    }
  }

  return {};
}

// Helper function to cache auth state
function cacheAuthState(state: AuthState) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem('auth-state', JSON.stringify({
      user: state.user,
    }));
  } catch (error) {
    console.warn('Failed to cache auth state:', error);
  }
}

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  let newState: AuthState;

  switch (action.type) {
    case 'SIGN_IN_START':
      newState = {
        ...state,
        loading: true,
        error: null,
      };
      break;
    case 'SIGN_IN_SUCCESS':
      newState = {
        ...state,
        user: action.payload,
        loading: false,
        error: null,
      };
      break;
    case 'SIGN_IN_ERROR':
      newState = {
        ...state,
        user: null,
        loading: false,
        error: action.payload,
      };
      break;
    case 'SIGN_OUT':
      newState = {
        ...state,
        user: null,
        loading: false,
        error: null,
      };
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('auth-state');
      }
      break;
    case 'UPDATE_USER':
      newState = {
        ...state,
        user: action.payload,
      };
      break;
    case 'SET_LOADING':
      newState = {
        ...state,
        loading: action.payload,
      };
      break;
    case 'SET_ERROR':
      newState = {
        ...state,
        error: action.payload,
      };
      break;
    default:
      newState = state;
  }

  if (newState !== state && (action.type === 'SIGN_IN_SUCCESS' || action.type === 'SIGN_OUT' || action.type === 'UPDATE_USER')) {
    cacheAuthState(newState);
  }

  return newState;
}

// Helper function to fetch user profile - takes user from session, not from API call
async function fetchUserData(user: User): Promise<AuthUser> {
  // 即使 profile 获取失败，也返回基本用户信息
  // 这样用户至少能登录，只是没有完整 profile
  try {
    const [{ profile, isAdmin }, credits] = await Promise.all([
      UserDataService.getUserData(user.id),
      CreditsService.getUserCredits(user.id),
    ]);
    return { ...user, profile: profile || undefined, credits: credits || undefined, isAdmin };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return { ...user, profile: undefined, credits: undefined, isAdmin: false };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const stateRef = useRef(state);

  stateRef.current = state;

  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;
    let isBackgroundValidating = false;

    const loadUser = async () => {
      const cachedState = getCachedAuthState();
      console.log('[AuthProvider] loadUser: cachedUser=', !!cachedState.user);

      if (cachedState.user && isMounted) {
        dispatch({ type: 'UPDATE_USER', payload: cachedState.user });
        dispatch({ type: 'SET_LOADING', payload: false });
      } else {
        // 无缓存用户，设置超时防止永久 loading
        setTimeout(() => {
          if (isMounted && stateRef.current.loading) {
            console.log('[AuthProvider] Timeout: setting loading to false');
            dispatch({ type: 'SET_LOADING', payload: false });
          }
        }, 3000);
      }
    };

    const validateUserSilently = async () => {
      if (isBackgroundValidating) return;

      const currentUser = stateRef.current.user;
      if (!currentUser) return; // 没有用户，无需验证

      try {
        isBackgroundValidating = true;
        const completeUser = await fetchUserData(currentUser);
        if (isMounted) {
          dispatch({ type: 'UPDATE_USER', payload: completeUser });
        }
      } catch (error) {
        console.error('Silent validation failed:', error);
      } finally {
        isBackgroundValidating = false;
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && isMounted) {
        const currentState = stateRef.current;
        if (!currentState.user || currentState.error) {
          loadUser();
        } else {
          validateUserSilently();
        }
      }
    };

    loadUser();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    authSubscription = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] onAuthStateChange:', event, session?.user?.id);

        if (!isMounted || isBackgroundValidating) return;

        const currentUser = stateRef.current.user;

        switch (event) {
          case 'INITIAL_SESSION':
            if (session?.user) {
              // 立即设置基本用户信息，不等待 profile
              const basicUser: AuthUser = { ...session.user, profile: undefined, isAdmin: false };
              dispatch({ type: 'SIGN_IN_SUCCESS', payload: basicUser });
              // 后台获取完整 profile
              fetchUserData(session.user).then((completeUser) => {
                if (isMounted) {
                  dispatch({ type: 'UPDATE_USER', payload: completeUser });
                }
              });
            } else {
              dispatch({ type: 'SIGN_OUT' });
            }
            break;
          case 'SIGNED_IN':
            if (session?.user) {
              // 立即设置基本用户信息
              const basicUser: AuthUser = { ...session.user, profile: undefined, isAdmin: false };
              if (!currentUser || currentUser.id !== session.user.id) {
                dispatch({ type: 'SIGN_IN_SUCCESS', payload: basicUser });
              }
              // 后台获取完整 profile
              fetchUserData(session.user).then((completeUser) => {
                if (isMounted) {
                  dispatch({ type: 'UPDATE_USER', payload: completeUser });
                }
              });
            }
            break;
          case 'SIGNED_OUT':
            console.log('[AuthProvider] SIGNED_OUT: dispatching SIGN_OUT');
            dispatch({ type: 'SIGN_OUT' });
            break;
          case 'TOKEN_REFRESHED':
            if (session?.user) {
              // 后台更新，不阻塞
              fetchUserData(session.user).then((completeUser) => {
                if (isMounted) {
                  dispatch({ type: 'UPDATE_USER', payload: completeUser });
                }
              });
            }
            break;
        }
      },
    );

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (authSubscription) {
        authSubscription.data.subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    dispatch({ type: 'SIGN_IN_START' });
    const result = await AuthClientService.signIn(email, password);
    if (result.error) {
      dispatch({ type: 'SIGN_IN_ERROR', payload: result.error });
      return { error: result.error };
    }
    return {};
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    dispatch({ type: 'SIGN_IN_START' });
    const result = await AuthClientService.signInWithGoogle(redirectTo);
    if (result.error) {
      dispatch({ type: 'SIGN_IN_ERROR', payload: result.error });
      return { error: result.error };
    }
    return {};
  };

  const signUp = async (email: string, password: string, displayName?: string, options?: { redirectTo?: string }) => {
    dispatch({ type: 'SIGN_IN_START' });
    const result = await AuthClientService.signUp(email, password, displayName, options);

    if (result.error) {
      dispatch({ type: 'SIGN_IN_ERROR', payload: result.error });
      return { error: result.error };
    }

    return {};
  };

  const signOut = async () => {
    const result = await AuthClientService.signOut();
    if (result.error) {
      dispatch({ type: 'SET_ERROR', payload: result.error });
    }
  };

  const resetPassword = async (email: string) => {
    const result = await AuthClientService.resetPassword(email);
    if (result.error) {
      return { error: result.error };
    }
    return {};
  };

  const updateProfile = async (profileUpdates: Partial<UserProfile>) => {
    if (!state.user) {
      return { error: 'No user logged in' };
    }

    try {
      const updatedProfile = await UserDataService.updateUserProfile(state.user.id, profileUpdates);

      if (updatedProfile) {
        const updatedUser: AuthUser = {
          ...state.user,
          profile: updatedProfile,
        };
        dispatch({ type: 'UPDATE_USER', payload: updatedUser });
        return {};
      }

      return { error: 'Failed to update profile' };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { error: 'Failed to update profile' };
    }
  };

  const refreshUser = async () => {
    if (!state.user) return;
    const completeUser = await fetchUserData(state.user);
    dispatch({ type: 'UPDATE_USER', payload: completeUser });
  };

  const refreshCredits = async () => {
    if (!state.user) return;
    const credits = await CreditsService.getUserCredits(state.user.id);
    if (credits) {
      const updatedUser: AuthUser = { ...state.user, credits };
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    }
  };

  const spendCredits = async (amount: number, description: string, referenceId?: string) => {
    if (!state.user) {
      return { success: false, error: 'Not logged in' };
    }
    const result = await CreditsService.spendCredits(state.user.id, amount, description, referenceId);
    if (result.success && result.balance !== undefined) {
      // Update local state
      const updatedCredits: UserCredits = {
        ...state.user.credits!,
        balance: result.balance,
        totalSpent: (state.user.credits?.totalSpent || 0) + amount,
        updatedAt: new Date(),
      };
      const updatedUser: AuthUser = { ...state.user, credits: updatedCredits };
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    }
    return result;
  };

  const value: AuthContextType = {
    ...state,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    refreshUser,
    refreshCredits,
    spendCredits,
    isAdmin: state.user?.isAdmin ?? false,
    credits: state.user?.credits?.balance ?? 0,
  };

  return (
    <AuthContext value={value}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = use(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
