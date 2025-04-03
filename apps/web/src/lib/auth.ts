"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "./supabase";

/**
 * Checks if a user is authenticated and returns the user object if they are
 */
export async function checkUserSession(): Promise<User | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          return cookie?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: any) {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  return session.user;
}

/**
 * Redirects to login page if user is not authenticated
 */
export async function requireAuth() {
  const user = await checkUserSession();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Redirects to dashboard if user is already authenticated
 */
export async function redirectIfAuthenticated() {
  const user = await checkUserSession();

  if (user) {
    redirect("/dashboard");
  }

  return null;
}

/**
 * Utility for reading auth cookies from requests
 */
export function getAuthCookie(req: NextRequest) {
  // Read the session cookie directly from the request
  return req.cookies.get("sb-auth-token")?.value;
}

/**
 * Simplified function to check if a user is authenticated
 * based on the presence of auth cookies
 */
export function isAuthenticated(req: NextRequest): boolean {
  const cookie = getAuthCookie(req);
  return !!cookie;
}

/**
 * Utility to set auth cookies on a response
 */
export function setAuthCookie(
  res: NextResponse,
  value: string,
  options: { maxAge?: number; secure?: boolean; path?: string } = {}
) {
  res.cookies.set({
    name: "sb-auth-token",
    value,
    maxAge: options.maxAge || 60 * 60 * 24 * 7, // 1 week
    path: options.path || "/",
    secure: options.secure || process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  });
}

/**
 * Utility to remove auth cookies
 */
export function removeAuthCookie(res: NextResponse) {
  res.cookies.set({
    name: "sb-auth-token",
    value: "",
    maxAge: 0, // This will expire the cookie immediately
    path: "/",
  });
}

/**
 * Server-side function to validate a session
 * Can be used in middleware or route handlers
 */
export async function validateSessionFromCookie(
  req: NextRequest
): Promise<boolean> {
  const cookie = getAuthCookie(req);
  if (!cookie) return false;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser(cookie);
    return !!data.user && !error;
  } catch (error) {
    console.error("Error validating session from cookie:", error);
    return false;
  }
}
