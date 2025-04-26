import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

// Re-export createBrowserClient for use in our interceptor
export { createSupabaseBrowserClient as createBrowserClient };

export function createClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
