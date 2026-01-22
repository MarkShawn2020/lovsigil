import { supabase } from './Supabase';

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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { user: data.user };
    } catch {
      return { error: 'An unexpected error occurred' };
    }
  }

  /**
   * Sign in with Google OAuth
   */
  static async signInWithGoogle(redirectTo?: string) {
    try {
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      const locale = window.location.pathname.match(/^\/([^/]+)\//)?.[1] || 'zh';
      const redirectPath = redirectTo
        ? (redirectTo.startsWith('http') ? new URL(redirectTo).pathname : redirectTo)
        : `/${locale}`;
      callbackUrl.searchParams.set('next', redirectPath);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl.toString() },
      });

      if (error) return { error: error.message };
      return { data };
    } catch {
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
   * @deprecated 不要直接调用，使用 onAuthStateChange 代替
   * @supabase/ssr 的 getSession() 会死锁
   */
  static async getSession() {
    // 通过 onAuthStateChange 获取 session（它会立即触发当前状态）
    return new Promise<{ session: any; error?: string }>((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ session: null, error: undefined });
      }, 3000);

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        clearTimeout(timeout);
        subscription.unsubscribe();
        resolve({ session, error: undefined });
      });
    });
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
