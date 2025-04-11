/**
 * @deprecated Use createClient from @/lib/supabase/server instead.
 * This file will be removed in a future release.
 */

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * @deprecated Use createClient from @/lib/supabase/server instead.
 */
export async function createServerSupabaseClient() {
  return createClient();
}

/**
 * @deprecated Use createClient from @/lib/supabase/server instead.
 */
export function createServerSupabaseClientWithCookies(
  cookieStore: ReturnType<typeof cookies>
) {
  // This function is maintained for backward compatibility,
  // but the new implementation doesn't require passing cookies
  return createClient();
}