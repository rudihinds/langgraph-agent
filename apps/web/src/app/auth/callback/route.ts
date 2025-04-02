import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Get the code from the URL
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  if (code) {
    // Exchange the code for a session
    await supabase.auth.exchangeCodeForSession(code);
  }
  
  // Redirect to the home page
  return NextResponse.redirect(new URL('/', request.url));
}