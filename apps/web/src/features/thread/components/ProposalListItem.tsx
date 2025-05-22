import React from "react";

interface ProposalListItemProps {
  // Define props for a single thread item, e.g., threadId, title, date
  title?: string | null;
  threadId: string;
  createdAt: string;
  onSelect: (threadId: string, rfpId: string | null) => void; // Assuming rfpId might be associated
  rfpId?: string | null; // Add rfpId if it's part of the thread data displayed or needed for selection
}

const ProposalListItem: React.FC<ProposalListItemProps> = ({
  title,
  threadId,
  createdAt,
  onSelect,
  rfpId,
}) => {
  const handleSelect = () => {
    onSelect(threadId, rfpId || null);
  };

  return (
    <div
      onClick={handleSelect}
      className="cursor-pointer border border-border rounded-md p-3 hover:bg-muted transition-colors"
    >
      <h4 className="font-semibold text-sm mb-1 truncate">
        {title || `Proposal Thread: ${threadId.substring(0, 8)}...`}
      </h4>
      <p className="text-xs text-muted-foreground">
        Created: {new Date(createdAt).toLocaleDateString()}
      </p>
    </div>
  );
};

export default ProposalListItem;
