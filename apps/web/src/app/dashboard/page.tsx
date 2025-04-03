"use client";

import { useEffect, useState } from "react";
import EmptyProposalState from "@/components/dashboard/EmptyProposalState";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import NewProposalModal from "@/components/dashboard/NewProposalModal";
import { ProposalGrid } from "@/components/dashboard/ProposalGrid";
import { ProposalCard } from "@/components/dashboard/ProposalCard";
import NewProposalCard from "@/components/dashboard/NewProposalCard";
import { getProposals, Proposal } from "@/lib/api/proposals";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProposals() {
      try {
        setIsLoading(true);
        const data = await getProposals();
        setProposals(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching proposals:", err);
        setError("Failed to load proposals");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProposals();
  }, []);

  // Handlers for proposal actions
  const handleEditProposal = (id: string) => {
    console.log(`Edit proposal ${id}`);
    // Navigate to edit page
    window.location.href = `/proposals/${id}`;
  };

  const handleDeleteProposal = (id: string) => {
    console.log(`Delete proposal ${id}`);
    // Implement delete confirmation
  };

  const handleExportProposal = (id: string) => {
    console.log(`Export proposal ${id}`);
    // Implement export functionality
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="container px-4 py-6 mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Your Proposals
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage your proposal drafts, works in progress, and submissions
            </p>
          </div>
          <Button className="gap-1" onClick={() => setIsModalOpen(true)}>
            <PlusIcon className="w-4 h-4" />
            New Proposal
          </Button>
        </div>

        <DashboardSkeleton />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="container px-4 py-6 mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Your Proposals
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage your proposal drafts, works in progress, and submissions
            </p>
          </div>
          <Button className="gap-1" onClick={() => setIsModalOpen(true)}>
            <PlusIcon className="w-4 h-4" />
            New Proposal
          </Button>
        </div>

        <div className="p-4 border border-destructive/50 rounded bg-destructive/10 text-center">
          <p className="text-destructive">{error}</p>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // If there are no proposals, show the empty state
  if (proposals.length === 0) {
    return (
      <div className="container px-4 py-6 mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Your Proposals
            </h1>
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

  // If there are proposals, show the grid with proposals
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <NewProposalCard />

        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onEdit={handleEditProposal}
            onDelete={handleDeleteProposal}
            onExport={handleExportProposal}
          />
        ))}
      </div>

      <NewProposalModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
}
