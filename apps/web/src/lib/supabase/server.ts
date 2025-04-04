import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { type CookieContainer } from '@/lib/supabase/types';

export function createClient(cookieContainer: CookieContainer) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return cookieContainer.get(name)?.value;
      },
      set(name: string, value: string, options: { path: string; maxAge: number; domain: string }) {
        cookieContainer.set(name, value, options);
      },
      remove(name: string, options: { path: string; maxAge: number; domain: string }) {
        cookieContainer.set(name, '', { ...options, maxAge: 0 });
      },
    },
  });
}