"use client";

import { useState } from "react";
import { Card, CardContent } from "@/features/ui/components/card";
import { Plus } from "lucide-react";
import NewProposalModal from "./NewProposalModal";
import { cn } from "@/lib/utils/utils";

// MODEL
interface NewProposalCardProps {
  className?: string;
  onClick?: () => void;
}

function useNewProposalCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  return {
    isModalOpen,
    setIsModalOpen,
    handleOpenModal,
  };
}

// VIEW
function NewProposalCardView({
  className,
  onClick,
  isModalOpen,
  setIsModalOpen,
  handleOpenModal,
}: NewProposalCardProps & ReturnType<typeof useNewProposalCard>) {
  return (
    <>
      <Card
        className={cn(
          "flex items-center justify-center border-dashed bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors p-8 h-full",
          className
        )}
        onClick={onClick || handleOpenModal}
        data-testid="new-proposal-card"
      >
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium">Create New Proposal</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Start your next winning proposal
          </p>
        </div>
      </Card>

      {!onClick && (
        <NewProposalModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      )}
    </>
  );
}

// COMPONENT
export default function NewProposalCard(props: NewProposalCardProps) {
  const model = useNewProposalCard();
  return <NewProposalCardView {...props} {...model} />;
}
