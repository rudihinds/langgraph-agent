"use client";

import { ProposalCreationFlow } from "@/components/proposals/ProposalCreationFlow";
import { ProposalType } from "@/components/proposals/ProposalCreationFlow";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function CreateProposalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [proposalType, setProposalType] = useState<ProposalType | null>(null);

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "rfp" || type === "application") {
      setProposalType(type);
    } else {
      // Redirect to dashboard if no valid proposal type is specified
      router.push("/dashboard");
    }
  }, [searchParams, router]);

  const handleCancel = () => {
    router.push("/dashboard");
  };

  if (!proposalType) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-slate-200 h-10 w-10"></div>
          <div className="flex-1 space-y-6 py-1">
            <div className="h-2 bg-slate-200 rounded"></div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="h-2 bg-slate-200 rounded col-span-2"></div>
                <div className="h-2 bg-slate-200 rounded col-span-1"></div>
              </div>
              <div className="h-2 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-xl mx-auto py-8">
      <ProposalCreationFlow 
        proposalType={proposalType} 
        onCancel={handleCancel} 
      />
    </div>
  );
}