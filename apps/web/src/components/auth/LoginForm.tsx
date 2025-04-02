import { useState } from 'react';
import { signInWithGoogle } from '@/lib/supabase';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in');
      console.error('Error signing in with Google:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6 bg-card rounded-lg shadow-md">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Welcome</h1>
        <p className="text-muted-foreground">Sign in to continue to Proposal Writer</p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-md border border-gray-300 shadow-sm transition-colors"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 488 512"
                className="w-5 h-5"
                fill="currentColor"
              >
                <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
              </svg>
              <span>Sign in with Google</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </div>
    </div>
  );
}