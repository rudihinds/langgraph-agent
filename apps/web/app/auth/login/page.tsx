import LoginButton from "@/features/auth/components/LoginButton";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-8 border rounded-lg shadow-md bg-card">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Login</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to access your dashboard
          </p>
        </div>
        <LoginButton />
      </div>
    </div>
  );
}
