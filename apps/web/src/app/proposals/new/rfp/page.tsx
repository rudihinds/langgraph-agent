"use client";

import { useRouter } from "next/navigation";
import ProposalCreationFlow from "@/components/proposals/ProposalCreationFlow";

export default function NewRfpProposalPage() {
  const router = useRouter();

  const handleCancel = () => {
    router.push("/dashboard");
  };

  return <ProposalCreationFlow proposalType="rfp" onCancel={handleCancel} />;
}
