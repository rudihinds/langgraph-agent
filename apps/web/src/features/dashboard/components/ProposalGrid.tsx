"use client";

import { ProposalCard } from "@/features/dashboard/components/ProposalCard";
import { EmptyProposalState } from "@/features/dashboard/components/EmptyProposalState";
import DashboardSkeleton from "@/features/dashboard/components/DashboardSkeleton";
import { cn } from "@/lib/utils/utils";

// MODEL: Define the data structure
interface ProposalGridProps {
  proposals: Array<{
    id: string;
    title: string;
    organization?: string;
    status: string;
    progress: number;
    createdAt: string;
    updatedAt: string;
    dueDate?: string;
    phase?: string;
  }>;
  isLoading?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onExport?: (id: string) => void;
  className?: string;
}

// PRESENTATION: Render the UI
function ProposalGridView({
  proposals,
  isLoading,
  onEdit,
  onDelete,
  onExport,
}: ProposalGridProps) {
  // If loading, show skeleton
  if (isLoading) {
    return null;
  }

  // If no proposals, show empty state
  if (!proposals?.length) {
    return null;
  }

  return (
    <>
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          onEdit={onEdit}
          onDelete={onDelete}
          onExport={onExport}
        />
      ))}
    </>
  );
}

// COMPONENT: Handle interactions
export function ProposalGrid(props: ProposalGridProps) {
  const handleEdit = (id: string) => {
    props.onEdit?.(id);
    console.log(`Edit proposal: ${id}`);
  };

  const handleDelete = (id: string) => {
    props.onDelete?.(id);
    console.log(`Delete proposal: ${id}`);
  };

  const handleExport = (id: string) => {
    props.onExport?.(id);
    console.log(`Export proposal: ${id}`);
  };

  return (
    <ProposalGridView
      proposals={props.proposals}
      isLoading={props.isLoading}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onExport={handleExport}
    />
  );
}
