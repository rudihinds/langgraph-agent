"use client";

import EmptyProposalState from "@/components/dashboard/EmptyProposalState";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import NewProposalModal from "@/components/dashboard/NewProposalModal";

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="container px-4 py-6 mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Proposals</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your proposal drafts, works in progress, and submissions
          </p>
        </div>
        <Button className="gap-1" onClick={() => setIsModalOpen(true)}>
          <PlusIcon className="w-4 h-4" />
          New Proposal
        </Button>
      </div>

      <EmptyProposalState />

      <NewProposalModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
}
