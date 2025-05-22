"use client";

import { useEffect, useState } from "react";
import { EmptyProposalState } from "@/features/dashboard/components/EmptyProposalState";
import { Button } from "@/features/ui/components/button";
import { PlusIcon } from "lucide-react";
import NewProposalModal from "@/features/dashboard/components/NewProposalModal";
import ProposalTypeModal, {
  ProposalType,
} from "@/features/dashboard/components/ProposalTypeModal";
import { ProposalGrid } from "@/features/dashboard/components/ProposalGrid";
import NewProposalCard from "@/features/dashboard/components/NewProposalCard";
import { getUserProposals, Proposal } from "@/features/proposals/api/proposals";
import { calculateProgress } from "@/features/proposals/utils/calculations";
import DashboardSkeleton from "@/features/dashboard/components/DashboardSkeleton";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, error } = useSession();
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ProposalType | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  // Log authentication state - authentication check
  useEffect(() => {
    if (!isLoading) {
      console.log(
        "[Dashboard] Auth state loaded, user:",
        user ? "authenticated" : "not authenticated"
      );
    }
  }, [user, isLoading]);

  // Fetch proposals when authenticated
  useEffect(() => {
    if (user) {
      async function fetchProposals() {
        try {
          setIsDataLoading(true);
          const data = await getUserProposals();

          const formattedProposals = data.map((proposal: any) => {
            return {
              id: proposal.id,
              title: proposal.title || "Untitled Proposal",
              organization: proposal.organization || undefined,
              status: proposal.status || "draft",
              progress: calculateProgress(proposal) || 0,
              createdAt: proposal.created_at,
              updatedAt: proposal.updated_at || proposal.created_at,
              phase: proposal.phase || "planning",
              dueDate: proposal.due_date || undefined,
              associatedThreadId: proposal.associatedThreadId || null,
            };
          });

          console.log(
            "[DashboardPage] Formatted proposals:",
            JSON.stringify(formattedProposals, null, 2)
          );
          setProposals(formattedProposals);
          setDataError(null);
        } catch (err) {
          console.error("Error fetching proposals:", err);
          setDataError("Failed to load proposals");
        } finally {
          setIsDataLoading(false);
        }
      }

      fetchProposals();
    }
  }, [user]);

  // Handlers for proposal actions
  const handleEditProposal = (id: string) => {
    console.log(`Edit proposal ${id}`);
    // Navigate to edit page
    router.push(`/proposals/${id}`);
  };

  const handleDeleteProposal = (id: string) => {
    console.log(`Delete proposal ${id}`);
    // Implement delete confirmation
  };

  const handleExportProposal = (id: string) => {
    console.log(`Export proposal ${id}`);
    // Implement export functionality
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

  // If session is loading, show full page skeleton
  if (isLoading) {
    return (
      <div className="container px-4 py-6 mx-auto">
        <DashboardSkeleton />
      </div>
    );
  }

  console.log(
    "[DashboardPage] Props being sent to ProposalGrid - proposals state:",
    JSON.stringify(proposals, null, 2)
  );
  console.log(
    "[DashboardPage] Props being sent to ProposalGrid - isDataLoading state:",
    isDataLoading
  );

  // Common page structure (Header, New Proposal Button, Announcement)
  const PageStructure: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => (
    <div className="container px-4 py-6 mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Proposals</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your proposal drafts, works in progress, and submissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="gap-1" onClick={() => setIsTypeModalOpen(true)}>
            <PlusIcon className="w-4 h-4" />
            New Proposal
          </Button>
        </div>
      </div>
      {showAnnouncement && (
        <div className="relative p-4 mb-6 border rounded-lg border-primary/30 bg-primary/5">
          <button
            onClick={() => setShowAnnouncement(false)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss announcement"
          >
            ✕
          </button>
          <h3 className="mb-1 font-semibold text-primary">
            Enhanced RFP Form Now Available!
          </h3>
          <p className="mb-2 text-sm text-muted-foreground">
            We've improved our RFP submission process with real-time validation,
            progress tracking, and better file handling.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/proposals/new/rfp")}
            className="mt-1 text-xs"
          >
            Try it now
          </Button>
        </div>
      )}
      {children}{" "}
      {/* Content like error message, empty state, or grid will go here */}
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

  if (dataError) {
    return (
      <PageStructure>
        <div className="p-4 text-center border rounded border-destructive/50 bg-destructive/10">
          <p className="text-destructive">{dataError}</p>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </PageStructure>
    );
  }

  // Define content to be rendered inside PageStructure
  let content;
  if (isDataLoading) {
    content = (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <NewProposalCard onClick={() => setIsTypeModalOpen(true)} />
        <DashboardSkeleton />
      </div>
    );
  } else if (proposals.length === 0) {
    content = (
      <div className="text-center">
        <div className="inline-block mb-8">
          <NewProposalCard onClick={() => setIsTypeModalOpen(true)} />
        </div>
        <EmptyProposalState onCreateClick={() => setIsTypeModalOpen(true)} />
      </div>
    );
  } else {
    content = (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <NewProposalCard onClick={() => setIsTypeModalOpen(true)} />
        <ProposalGrid
          proposals={proposals}
          isLoading={false}
          onEdit={handleEditProposal}
          onDelete={handleDeleteProposal}
          onExport={handleExportProposal}
        />
      </div>
    );
  }

  return <PageStructure>{content}</PageStructure>;
}
