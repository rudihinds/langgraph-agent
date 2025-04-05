"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { ENV } from "@/env";

/**
 * Server-side Supabase client that handles cookies properly.
 * Can be used in Server Components, Route Handlers, and Server Actions.
 */
export const createClient = cache(
  async (
    cookieStore?:
      | ReturnType<typeof cookies>
      | Promise<ReturnType<typeof cookies>>
  ) => {
    try {
      if (!ENV.NEXT_PUBLIC_SUPABASE_URL) {
        console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
        return null;
      }

      if (!ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
        return null;
      }

      // Use provided cookie store or get from next/headers
      let cookieJar;
      try {
        cookieJar = cookieStore
          ? cookieStore instanceof Promise
            ? await cookieStore
            : cookieStore
          : await cookies();
      } catch (cookieError) {
        console.error(
          "[Supabase Client] Error accessing cookies:",
          cookieError
        );
        return null;
      }

      return createServerClient(
        ENV.NEXT_PUBLIC_SUPABASE_URL,
        ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            async getAll() {
              try {
                // Make sure to use await to satisfy Next.js expectations
                return await cookieJar.getAll();
              } catch (error) {
                console.error(
                  "[Supabase Client] Error getting cookies:",
                  error
                );
                return [];
              }
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieJar.set(name, value, options)
                );
              } catch (error) {
                console.error(
                  "[Supabase Client] Error setting cookies:",
                  error
                );
                // This can be ignored if you have middleware refreshing user sessions
              }
            },
          },
        }
      );
    } catch (error) {
      console.error("[Supabase Client] Failed to create client:", error);
      return null;
    }
  }
);
