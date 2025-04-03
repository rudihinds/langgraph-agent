import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

// Create a server-side Supabase client for secure authentication flows
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            return cookieStore.get(name)?.value;
          } catch (error) {
            console.error(`Error getting cookie ${name}:`, error);
            return undefined;
          }
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // This can sometimes fail in middleware when cookies are immutable
            console.error(`Error setting cookie ${name}:`, error);
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch (error) {
            console.error(`Error removing cookie ${name}:`, error);
          }
        },
      },
    }
  );
}

// Create a server-side client with custom cookie handling, useful for route handlers
export function createServerSupabaseClientWithCookies(
  cookieStore: ReadonlyRequestCookies,
  response?: Response
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            return cookieStore.get(name)?.value;
          } catch (error) {
            console.error(`Error getting cookie ${name}:`, error);
            return undefined;
          }
        },
        set(name: string, value: string, options: any) {
          if (response) {
            try {
              // If we have a response object, set the cookie on it
              response.headers.append(
                "Set-Cookie",
                `${name}=${value}; ${Object.entries(options)
                  .map(([key, value]) => `${key}=${value}`)
                  .join("; ")}`
              );
            } catch (error) {
              console.error(`Error setting cookie ${name} on response:`, error);
            }
          }
        },
        remove(name: string, options: any) {
          if (response) {
            try {
              response.headers.append(
                "Set-Cookie",
                `${name}=; ${Object.entries({ ...options, maxAge: 0 })
                  .map(([key, value]) => `${key}=${value}`)
                  .join("; ")}`
              );
            } catch (error) {
              console.error(
                `Error removing cookie ${name} from response:`,
                error
              );
            }
          }
        },
      },
    }
  );
}
