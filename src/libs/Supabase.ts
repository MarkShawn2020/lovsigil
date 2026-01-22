import { createBrowserClient } from '@supabase/ssr';
import { Env } from './Env';

// Client-side Supabase instance with cookie-based session storage
// This syncs with the middleware's cookie-based auth check
console.log('[DEBUG][Supabase] 初始化, URL:', Env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + '...');
export const supabase = createBrowserClient(
  Env.NEXT_PUBLIC_SUPABASE_URL || '',
  Env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);
console.log('[DEBUG][Supabase] 客户端创建完成');
