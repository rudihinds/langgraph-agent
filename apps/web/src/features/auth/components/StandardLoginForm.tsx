"use client";

import { useState } from 'react';
import { signIn } from "@/lib/supabase/auth/actions";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { FormError, FormErrorBoundary, FieldError } from "@/features/ui/components/form-error";
import { Button } from "@/features/ui/components/button";
import { Input } from "@/features/ui/components/input";
import { Form, FormItem, FormLabel, FormControl, FormMessage } from "@/features/ui/components/form";
import { createServerAction } from "@/lib/errors/server-action";
import { z } from 'zod';

// Login validation schema
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

// Create server action with error handling
const handleLogin = createServerAction(
  async (data: z.infer<typeof loginSchema>) => {
    const result = await signIn();
    if (!result.success) {
      throw new Error(result.error?.message || 'Login failed');
    }
    return result.data;
  },
  {
    actionName: 'login',
    schema: loginSchema,
    transformInput: (formData: FormData) => ({
      email: formData.get('email') as string,
      password: formData.get('password') as string
    })
  }
);

export function StandardLoginForm() {
  const {
    isPending,
    formError,
    fieldErrors,
    handleSubmit,
    getFieldError,
  } = useFormSubmit(handleLogin, {
    onSuccess: () => {
      // Redirect happens automatically after successful auth
      console.log('Login successful');
    }
  });

  return (
    <FormErrorBoundary>
      <div className="w-full max-w-md mx-auto p-6 space-y-6 bg-card rounded-lg shadow-md">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to continue to your account</p>
        </div>

        {formError && (
          <FormError 
            message={formError}
            dismissible
          />
        )}

        <Form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleSubmit(formData);
        }}>
          <div className="space-y-4">
            <FormItem>
              <FormLabel htmlFor="email">Email</FormLabel>
              <FormControl>
                <Input 
                  id="email"
                  name="email" 
                  type="email" 
                  placeholder="your.email@example.com"
                  className={getFieldError('email') ? 'border-destructive' : ''}
                  required
                />
              </FormControl>
              <FieldError error={getFieldError('email')} />
            </FormItem>

            <FormItem>
              <FormLabel htmlFor="password">Password</FormLabel>
              <FormControl>
                <Input 
                  id="password"
                  name="password" 
                  type="password" 
                  placeholder="••••••••"
                  className={getFieldError('password') ? 'border-destructive' : ''}
                  required
                />
              </FormControl>
              <FieldError error={getFieldError('password')} />
            </FormItem>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isPending}
            >
              {isPending ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </Form>

        <div className="mt-4 text-center text-sm">
          <a href="#" className="text-primary hover:underline">
            Forgot your password?
          </a>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full flex items-center justify-center gap-2"
          onClick={() => handleSubmit({ provider: 'google' })}
          disabled={isPending}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 488 512"
            className="w-4 h-4"
            fill="currentColor"
          >
            <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
          </svg>
          <span>Google</span>
        </Button>

        <div className="mt-4 text-center text-sm">
          Don't have an account?{' '}
          <a href="/signup" className="text-primary hover:underline">
            Sign up
          </a>
        </div>
      </div>
    </FormErrorBoundary>
  );
}