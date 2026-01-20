'use client';

import type { User } from '@supabase/supabase-js';
import React, { createContext, use, useEffect, useReducer, useRef } from 'react';
import { AuthClientService } from '@/libs/AuthClient';
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
  isAdmin: boolean;
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

// Helper function to fetch user data directly from Supabase using RLS
async function fetchUserData(userId: string): Promise<AuthUser | null> {
  try {
    const { user, error } = await AuthClientService.getCurrentUser();

    if (error || !user || user.id !== userId) {
      return null;
    }

    const { profile, isAdmin } = await UserDataService.getUserData(userId);

    return {
      ...user,
      profile: profile || undefined,
      isAdmin,
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
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
      try {
        dispatch({ type: 'SET_LOADING', payload: true });

        const cachedState = getCachedAuthState();

        if (cachedState.user && isMounted) {
          dispatch({ type: 'UPDATE_USER', payload: cachedState.user });
        }

        const { session, error } = await AuthClientService.getSession();

        if (error) {
          console.warn('Error getting session:', error);
          if (cachedState.user && error.includes('timed out')) {
            console.log('Session timed out but have cached user, keeping cached state');
            if (isMounted) {
              dispatch({ type: 'SET_LOADING', payload: false });
            }
            return;
          }
          if (isMounted) {
            dispatch({ type: 'SIGN_IN_ERROR', payload: error });
          }
          return;
        }

        if (session?.user) {
          const completeUser = await fetchUserData(session.user.id);
          if (isMounted) {
            if (completeUser) {
              dispatch({ type: 'SIGN_IN_SUCCESS', payload: completeUser });
            } else {
              console.warn('Failed to fetch complete user data, signing out');
              dispatch({ type: 'SIGN_OUT' });
            }
          }
        } else {
          if (isMounted) {
            dispatch({ type: 'SIGN_OUT' });
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
        if (isMounted) {
          dispatch({ type: 'SIGN_IN_ERROR', payload: 'Failed to load user' });
        }
      }
    };

    const validateUserSilently = async () => {
      if (isBackgroundValidating) {
        console.log('Background validation already in progress, skipping');
        return;
      }

      try {
        isBackgroundValidating = true;
        console.log('Starting silent background validation');

        const { session, error } = await AuthClientService.getSession();

        if (error || !session?.user) {
          console.log('Silent validation: No valid session, signing out');
          if (isMounted) {
            dispatch({ type: 'SIGN_OUT' });
          }
          return;
        }

        const currentUser = stateRef.current.user;
        if (currentUser && session.user.id === currentUser.id) {
          console.log('Silent validation: Same user, refreshing profile silently');
          const completeUser = await fetchUserData(session.user.id);
          if (completeUser && isMounted) {
            dispatch({ type: 'UPDATE_USER', payload: completeUser });
          }
        } else {
          console.log('Silent validation: User changed, updating with loading');
          if (isMounted) {
            dispatch({ type: 'SIGN_IN_START' });
            const completeUser = await fetchUserData(session.user.id);
            dispatch({ type: 'SIGN_IN_SUCCESS', payload: completeUser || { ...session.user, isAdmin: false } });
          }
        }
      } catch (error) {
        console.error('Silent validation failed:', error);
      } finally {
        isBackgroundValidating = false;
        console.log('Silent background validation completed');
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && isMounted) {
        const currentState = stateRef.current;

        if (!currentState.user || currentState.error) {
          console.log('Page visible: No user data, loading with spinner');
          loadUser();
        } else {
          console.log('Page visible: Have user data, validating silently');
          validateUserSilently();
        }
      }
    };

    loadUser();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    authSubscription = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) {
          return;
        }

        console.log('Auth state change:', event, session?.user?.id, `(backgroundValidating: ${isBackgroundValidating})`);

        if (isBackgroundValidating) {
          console.log('Ignoring auth event during background validation to prevent circular triggering');
          return;
        }

        const currentUser = stateRef.current.user;

        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              if (!currentUser || currentUser.id !== session.user.id) {
                console.log('SIGNED_IN: New user detected, showing loading');
                dispatch({ type: 'SIGN_IN_START' });
                const completeUser = await fetchUserData(session.user.id);
                if (completeUser) {
                  dispatch({ type: 'SIGN_IN_SUCCESS', payload: completeUser });
                } else {
                  console.warn('Auth event SIGNED_IN but failed to fetch user data');
                  dispatch({ type: 'SIGN_IN_ERROR', payload: 'Failed to load user profile' });
                }
              } else {
                console.log('SIGNED_IN: Same user, updating without loading');
                const completeUser = await fetchUserData(session.user.id);
                if (completeUser) {
                  dispatch({ type: 'UPDATE_USER', payload: completeUser });
                }
              }
            }
            break;
          case 'SIGNED_OUT':
            dispatch({ type: 'SIGN_OUT' });
            break;
          case 'TOKEN_REFRESHED':
            if (session?.user) {
              const completeUser = await fetchUserData(session.user.id);
              if (completeUser) {
                dispatch({ type: 'UPDATE_USER', payload: completeUser });
              } else {
                console.warn('Token refreshed but failed to fetch user data, signing out');
                dispatch({ type: 'SIGN_OUT' });
              }
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
    console.log('🔑 AuthProvider signIn called with:', { email });
    dispatch({ type: 'SIGN_IN_START' });

    console.log('🌐 Calling AuthClientService.signIn...');
    const result = await AuthClientService.signIn(email, password);
    console.log('📋 AuthClientService result:', result);

    if (result.error) {
      console.error('❌ AuthProvider signIn error:', result.error);
      dispatch({ type: 'SIGN_IN_ERROR', payload: result.error });
      return { error: result.error };
    }

    console.log('✅ AuthProvider signIn successful, waiting for auth state change...');
    return {};
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    console.log('🔑 AuthProvider signInWithGoogle called');
    dispatch({ type: 'SIGN_IN_START' });

    console.log('🌐 Calling AuthClientService.signInWithGoogle...');
    const result = await AuthClientService.signInWithGoogle(redirectTo);
    console.log('📋 AuthClientService Google OAuth result:', result);

    if (result.error) {
      console.error('❌ AuthProvider Google OAuth error:', result.error);
      dispatch({ type: 'SIGN_IN_ERROR', payload: result.error });
      return { error: result.error };
    }

    console.log('✅ AuthProvider Google OAuth initiated successfully');
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
    if (!state.user) {
      return;
    }

    const completeUser = await fetchUserData(state.user.id);
    if (completeUser) {
      dispatch({ type: 'UPDATE_USER', payload: completeUser });
    }
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
    isAdmin: state.user?.isAdmin ?? false,
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
