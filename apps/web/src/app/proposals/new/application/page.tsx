"use client";

import { useRouter } from "next/navigation";
import ProposalCreationFlow from "@/components/proposals/ProposalCreationFlow";

export default function NewApplicationProposalPage() {
  const router = useRouter();

  const handleCancel = () => {
    router.push("/dashboard");
  };

  return (
    <ProposalCreationFlow proposalType="application" onCancel={handleCancel} />
  );
}
