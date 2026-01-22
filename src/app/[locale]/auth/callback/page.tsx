'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect } from 'react';

export default function AuthCallbackPage() {
  useEffect(() => {
    console.log('🔄 Callback page mounted');

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next') || '/zh';
        const code = params.get('code');

        console.log('📋 Callback params:', { next, code });

        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        if (code) {
          console.log('🔑 Exchanging code for session...');

          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔔 Auth event in callback:', event);
            if (event === 'SIGNED_IN' && session) {
              console.log('✅ SIGNED_IN detected, redirecting immediately');
              subscription.unsubscribe();
              window.location.replace(`${next}?just_signed_in=true`);
            }
          });

          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('❌ Code exchange error:', error);
            subscription.unsubscribe();
            window.location.replace(`/zh/sign-in?error=${encodeURIComponent(error.message)}`);
            return;
          }

          console.log('✅ Code exchange complete, redirecting...');
          subscription.unsubscribe();
          window.location.replace(`${next}?just_signed_in=true`);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('✅ Existing session found');
          window.location.href = `${next}?just_signed_in=true`;
          return;
        }

        console.log('❌ No code or session');
        window.location.href = '/zh/sign-in?error=no_code';
      } catch (err) {
        console.error('💥 Callback error:', err);
        window.location.href = '/zh/sign-in?error=callback_exception';
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground">正在登录...</p>
      </div>
    </div>
  );
}
