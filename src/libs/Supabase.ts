import { createBrowserClient } from '@supabase/ssr';
import { Env } from './Env';

// Client-side Supabase instance with cookie-based session storage
export const supabase = createBrowserClient(
  Env.NEXT_PUBLIC_SUPABASE_URL || '',
  Env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);
