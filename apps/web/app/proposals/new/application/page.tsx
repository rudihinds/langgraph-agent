"use client";

import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/supabase/auth";
import ProposalCreationFlow from "@/components/proposals/ProposalCreationFlow";
import { Loader2 } from "lucide-react";

export default function NewApplicationProposalPage() {
  const router = useRouter();
  const { user, loading, error } = useRequireAuth();

  const handleCancel = () => {
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="mt-4 text-muted-foreground">
            Loading your account...
          </span>
        </div>
      </div>
    );
  }

  if (error || !user) {
    router.push("/login?callbackUrl=/proposals/new/application");
    return null;
  }

  return (
    <div className="container mx-auto max-w-7xl">
      <ProposalCreationFlow
        proposalType="application"
        onCancel={handleCancel}
      />
    </div>
  );
}
