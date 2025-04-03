"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { ClipboardList, Check, Plus, PlusIcon } from "lucide-react";
import NewProposalModal from "./NewProposalModal";
import Image from "next/image";

// List of features to display
const featureList = [
  "Generate proposal content tailored to your needs",
  "Research your potential client or funding organization",
  "Create professional, well-structured documents",
  "Access templates for various proposal types",
  "Get AI-powered feedback on your writing",
];

export interface EmptyProposalStateProps {
  onCreateClick?: () => void;
}

export default function EmptyProposalState({
  onCreateClick,
}: EmptyProposalStateProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateClick = () => {
    if (onCreateClick) {
      onCreateClick();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 my-12 text-center border rounded-lg shadow-sm bg-background">
      <div className="relative w-40 h-40 mb-6">
        <Image
          src="/images/empty-proposals.svg"
          alt="No proposals"
          fill
          style={{ objectFit: "contain" }}
          priority
        />
      </div>
      <h2 className="mb-2 text-2xl font-semibold">No proposals yet</h2>
      <p className="max-w-md mb-6 text-muted-foreground">
        Create your first proposal to get started. Our AI assistant will help
        you craft compelling content tailored to your needs.
      </p>
      <Button onClick={handleCreateClick} className="gap-1">
        <PlusIcon className="w-4 h-4" />
        Create a Proposal
      </Button>

      {!onCreateClick && (
        <NewProposalModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      )}
    </div>
  );
}
