"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProposalCreatedPage() {
  const router = useRouter();
  
  // Add a timeout to auto-redirect to the dashboard after 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      router.push("/dashboard");
    }, 7000);
    
    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Proposal Created!</CardTitle>
          <CardDescription>
            Your proposal has been successfully created and saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4">
            You can now continue working on your proposal from the dashboard or start generating content using our AI assistant.
          </p>
          <p className="text-sm text-muted-foreground">
            You will be redirected to the dashboard in a few seconds...
          </p>
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">View Proposal</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}