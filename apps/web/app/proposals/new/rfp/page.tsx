"use client";

import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/supabase/auth";
import { RfpForm } from "@/features/proposals/components/RfpForm";
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (error || !user) {
    router.push("/login?callbackUrl=/proposals/new/rfp");
    return null;
  }

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-2xl px-4">
        <RfpForm userId={user.id} onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
