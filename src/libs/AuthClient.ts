import { supabase } from './Supabase';

const API_TIMEOUT_MS = 5000;

/**
 * Wrap a promise with timeout
 */
function withTimeout<T>(promise: PromiseLike<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
}

/**
 * Client-side authentication utilities
 * 只包含可在浏览器中安全运行的操作
 */
export class AuthClientService {
  /**
   * Sign in with email and password
   */
  static async signIn(email: string, password: string) {
    try {
      console.log('🔧 AuthClientService.signIn called with:', { email });
      console.log('🌐 Calling supabase.auth.signInWithPassword...');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('📊 Supabase auth response:', { user: data.user?.id, error: error?.message });

      if (error) {
        console.error('❌ Supabase auth error:', error.message);
        return { error: error.message };
      }

      console.log('✅ Supabase auth successful for user:', data.user?.id);
      return { user: data.user };
    } catch (error) {
      console.error('💥 AuthClientService unexpected error:', error);
      return { error: 'An unexpected error occurred' };
    }
  }

  /**
   * Sign in with Google OAuth
   */
  static async signInWithGoogle(redirectTo?: string) {
    try {
      console.log('🔧 AuthClientService.signInWithGoogle called');
      console.log('🌐 Calling supabase.auth.signInWithOAuth...');

      // 使用非 locale 的 callback 页面处理 OAuth callback
      const callbackUrl = new URL('/auth/callback', window.location.origin);

      // 获取当前 locale 用于 next 参数
      const locale = window.location.pathname.match(/^\/([^/]+)\//)?.[1] || 'zh';
      const redirectPath = redirectTo
        ? (redirectTo.startsWith('http') ? new URL(redirectTo).pathname : redirectTo)
        : `/${locale}/dashboard`;
      callbackUrl.searchParams.set('next', redirectPath);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      console.log('📊 Google OAuth response:', { data, error: error?.message });

      if (error) {
        console.error('❌ Google OAuth error:', error.message);
        return { error: error.message };
      }

      console.log('✅ Google OAuth initiated successfully');
      return { data };
    } catch (error) {
      console.error('💥 AuthClientService Google OAuth unexpected error:', error);
      return { error: 'An unexpected error occurred' };
    }
  }

  /**
   * Sign up with email and password
   */
  static async signUp(email: string, password: string, displayName?: string, options?: { redirectTo?: string }) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: options?.redirectTo,
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      return { user: data.user };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  }

  /**
   * Sign out
   */
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      return { error: error?.message };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error: error?.message };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  }

  /**
   * Get current session with timeout
   */
  static async getSession() {
    try {
      console.log('[DEBUG][AuthClient] getSession 开始, timeout:', API_TIMEOUT_MS);
      const startTime = Date.now();

      const { data: { session }, error } = await withTimeout(
        supabase.auth.getSession(),
        API_TIMEOUT_MS,
        'Session request timed out'
      );

      console.log('[DEBUG][AuthClient] getSession 完成, 耗时:', Date.now() - startTime, 'ms, session:', !!session);
      return { session, error: error?.message };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[AuthClient] getSession error:', message);
      return { session: null, error: message };
    }
  }

  /**
   * Refresh session
   */
  static async refreshSession() {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      return { session, error: error?.message };
    } catch (error) {
      return { session: null, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      return { user, error: error?.message };
    } catch (error) {
      return { user: null, error: 'An unexpected error occurred' };
    }
  }
}
