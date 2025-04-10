"use client";

import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/client-auth";
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
      <div className="flex justify-center items-center h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="container max-w-7xl mx-auto">
      <ProposalCreationFlow
        proposalType="application"
        onCancel={handleCancel}
      />
    </div>
  );
}
