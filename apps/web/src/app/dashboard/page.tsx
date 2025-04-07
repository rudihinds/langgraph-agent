"use client";

import { useEffect, useState } from "react";
import EmptyProposalState from "@/components/dashboard/EmptyProposalState";
import { Button } from "@/components/ui/button";
import { PlusIcon, LayoutGrid, LayoutList } from "lucide-react";
import NewProposalModal from "@/components/dashboard/NewProposalModal";
import ProposalTypeModal, {
  ProposalType,
} from "@/components/dashboard/ProposalTypeModal";
import { ProposalGrid } from "@/components/dashboard/ProposalGrid";
import { ProposalCard } from "@/components/dashboard/ProposalCard";
import NewProposalCard from "@/components/dashboard/NewProposalCard";
import { getProposals, Proposal } from "@/lib/api/proposals";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import { useRouter } from "next/navigation";

// Dummy proposal data for testing
const dummyProposals: Proposal[] = [
  {
    id: "1",
    title: "Community Health Initiative",
    organization: "Health Foundation",
    status: "in_progress",
    progress: 65,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    phase: "research",
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    title: "Youth Education Program",
    organization: "Education for All",
    status: "draft",
    progress: 25,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    phase: "planning",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    title: "Environmental Conservation Project",
    organization: "Green Earth",
    status: "completed",
    progress: 100,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    phase: "final",
  },
  {
    id: "4",
    title: "Tech Innovation Grant",
    organization: "Future Tech Foundation",
    status: "submitted",
    progress: 100,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    phase: "review",
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "5",
    title: "Urban Development Initiative",
    organization: "City Planning Commission",
    status: "in_progress",
    progress: 45,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    phase: "development",
    dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ProposalType | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Toggle for testing empty vs populated states
  const [showDummyData, setShowDummyData] = useState(true);
  // State for announcement banner visibility
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  useEffect(() => {
    async function fetchProposals() {
      try {
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
          setProposals(showDummyData ? dummyProposals : []);
          setError(null);
          setIsLoading(false);
        }, 1000);

        // Uncomment to use real API once it's working
        // const data = await getProposals();
        // setProposals(data);
        // setError(null);
      } catch (err) {
        console.error("Error fetching proposals:", err);
        setError("Failed to load proposals");
        setIsLoading(false);
      }
    }

    fetchProposals();
  }, [showDummyData]);

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

  // Toggle between empty and populated states
  const toggleDummyData = () => {
    setShowDummyData(!showDummyData);
  };

  // Handle proposal type selection
  const handleTypeSelect = (type: ProposalType) => {
    setSelectedType(type);
    // Redirect directly to the appropriate page based on the proposal type
    if (type === "rfp") {
      router.push("/proposals/new/rfp");
    } else if (type === "application") {
      router.push("/proposals/new/application");
    }
  };

  // Handle new proposal creation from modal
  const handleCreateProposal = (data: any) => {
    if (selectedType === "rfp") {
      router.push("/proposals/new/rfp");
    } else if (selectedType === "application") {
      router.push("/proposals/new/application");
    }
    setIsProposalModalOpen(false);
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={toggleDummyData}
              className="gap-1"
            >
              {showDummyData ? "Show Empty State" : "Show Proposals"}
            </Button>
            <Button className="gap-1" onClick={() => setIsTypeModalOpen(true)}>
              <PlusIcon className="w-4 h-4" />
              New Proposal
            </Button>
          </div>
        </div>

        {showAnnouncement && (
          <div className="mb-6 p-4 border border-primary/30 rounded-lg bg-primary/5 relative">
            <button
              onClick={() => setShowAnnouncement(false)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss announcement"
            >
              ✕
            </button>
            <h3 className="font-semibold text-primary mb-1">
              Enhanced RFP Form Now Available!
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              We've improved our RFP submission process with real-time
              validation, progress tracking, and better file handling.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/proposals/new/rfp")}
              className="text-xs mt-1"
            >
              Try it now
            </Button>
          </div>
        )}

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={toggleDummyData}
              className="gap-1"
            >
              {showDummyData ? "Show Empty State" : "Show Proposals"}
            </Button>
            <Button className="gap-1" onClick={() => setIsTypeModalOpen(true)}>
              <PlusIcon className="w-4 h-4" />
              New Proposal
            </Button>
          </div>
        </div>

        {showAnnouncement && (
          <div className="mb-6 p-4 border border-primary/30 rounded-lg bg-primary/5 relative">
            <button
              onClick={() => setShowAnnouncement(false)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss announcement"
            >
              ✕
            </button>
            <h3 className="font-semibold text-primary mb-1">
              Enhanced RFP Form Now Available!
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              We've improved our RFP submission process with real-time
              validation, progress tracking, and better file handling.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/proposals/new/rfp")}
              className="text-xs mt-1"
            >
              Try it now
            </Button>
          </div>
        )}

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={toggleDummyData}
              className="gap-1"
            >
              {showDummyData ? "Show Empty State" : "Show Proposals"}
            </Button>
            <Button className="gap-1" onClick={() => setIsTypeModalOpen(true)}>
              <PlusIcon className="w-4 h-4" />
              New Proposal
            </Button>
          </div>
        </div>

        {showAnnouncement && (
          <div className="mb-6 p-4 border border-primary/30 rounded-lg bg-primary/5 relative">
            <button
              onClick={() => setShowAnnouncement(false)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss announcement"
            >
              ✕
            </button>
            <h3 className="font-semibold text-primary mb-1">
              Enhanced RFP Form Now Available!
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              We've improved our RFP submission process with real-time
              validation, progress tracking, and better file handling.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/proposals/new/rfp")}
              className="text-xs mt-1"
            >
              Try it now
            </Button>
          </div>
        )}

        <EmptyProposalState onCreateClick={() => setIsTypeModalOpen(true)} />

        <ProposalTypeModal
          open={isTypeModalOpen}
          onOpenChange={setIsTypeModalOpen}
          onSelect={handleTypeSelect}
        />

        <NewProposalModal
          open={isProposalModalOpen}
          onOpenChange={setIsProposalModalOpen}
        />
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={toggleDummyData} className="gap-1">
            {showDummyData ? "Show Empty State" : "Show Proposals"}
          </Button>
          <Button className="gap-1" onClick={() => setIsTypeModalOpen(true)}>
            <PlusIcon className="w-4 h-4" />
            New Proposal
          </Button>
        </div>
      </div>

      {showAnnouncement && (
        <div className="mb-6 p-4 border border-primary/30 rounded-lg bg-primary/5 relative">
          <button
            onClick={() => setShowAnnouncement(false)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss announcement"
          >
            ✕
          </button>
          <h3 className="font-semibold text-primary mb-1">
            Enhanced RFP Form Now Available!
          </h3>
          <p className="text-sm text-muted-foreground mb-2">
            We've improved our RFP submission process with real-time validation,
            progress tracking, and better file handling.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/proposals/new/rfp")}
            className="text-xs mt-1"
          >
            Try it now
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <NewProposalCard onClick={() => setIsTypeModalOpen(true)} />

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

      <ProposalTypeModal
        open={isTypeModalOpen}
        onOpenChange={setIsTypeModalOpen}
        onSelect={handleTypeSelect}
      />

      <NewProposalModal
        open={isProposalModalOpen}
        onOpenChange={setIsProposalModalOpen}
      />
    </div>
  );
}
