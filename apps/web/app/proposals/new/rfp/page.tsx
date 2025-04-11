"use client";

import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/client-auth";
// Import the new RfpForm - leaving comment for now for reference
// import { RfpForm } from "@/components/proposals/RfpForm";
import { RfpForm } from "@/components/proposals/RfpFormNew";
import { Loader2 } from "lucide-react";

export default function NewRfpProposalPage() {
  const router = useRouter();
  const { user, loading, error } = useRequireAuth();

  const handleSuccess = (proposalId: string) => {
    router.push("/proposals/created");
  };

  const handleCancel = () => {
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (error || !user) {
    router.push("/login?callbackUrl=/proposals/new/rfp");
    return null;
  }

  return (
    <div className="container py-8">
      <RfpForm userId={user.id} onSuccess={handleSuccess} />
    </div>
  );
}
