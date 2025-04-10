/**
 * Environment variables used throughout the application
 * Type-safe access to environment variables
 */

// In a production app, you'd want to validate these with zod
// For now, we'll just have a simple type-safe wrapper

export const ENV = {
  // Supabase settings
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  
  // Site settings
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  
  // Helper method to check if we have all required env vars
  validate() {
    const missing = [];
    
    if (!this.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!this.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    return true;
  }
};

// Pre-validate in development to catch issues early
if (process.env.NODE_ENV === 'development') {
  try {
    ENV.validate();
  } catch (error) {
    console.warn('Environment validation failed:', error);
  }
}