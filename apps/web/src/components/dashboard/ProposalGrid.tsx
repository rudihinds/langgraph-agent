"use client";

import { ProposalCard } from "@/components/dashboard/ProposalCard";
import { EmptyProposalState } from "@/components/dashboard/EmptyProposalState";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import { cn } from "@/lib/utils";

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
  className,
}: ProposalGridProps) {
  // If loading, show skeleton
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // If no proposals, show empty state
  if (!proposals?.length) {
    return <EmptyProposalState />;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4",
        className
      )}
      data-testid="proposal-grid"
    >
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          onEdit={onEdit}
          onDelete={onDelete}
          onExport={onExport}
        />
      ))}
    </div>
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
      className={props.className}
    />
  );
}
