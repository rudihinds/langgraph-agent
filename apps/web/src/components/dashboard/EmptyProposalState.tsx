"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { ClipboardList, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Model - Handles component logic
export type EmptyProposalStateProps = {
  onCreateProposal: () => void;
};

// List of features to display
const featureList = [
  "AI-assisted research and writing",
  "Generate persuasive content based on RFP requirements",
  "Export ready-to-submit proposals in multiple formats",
];

// Presentation - Handles component styling
export function EmptyProposalStateView({
  onCreateProposal,
}: EmptyProposalStateProps) {
  return (
    <Card
      className="w-full border-dashed shadow-sm max-w-3xl mx-auto"
      data-testid="empty-proposal-state"
    >
      <CardHeader className="space-y-3 flex flex-col items-center text-center pt-10">
        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-primary/10 mb-3">
          <ClipboardList
            data-testid="empty-state-icon"
            className="h-8 w-8 text-primary"
          />
        </div>
        <h2 className="text-2xl font-semibold">No Proposals Yet</h2>
        <CardDescription className="max-w-md text-base">
          Create your first proposal to get started. Our AI agent will guide you
          through the process of crafting an effective proposal.
        </CardDescription>
      </CardHeader>
      <CardContent
        data-testid="card-content"
        className="flex flex-col items-center pb-4"
      >
        <ul className="text-sm space-y-3 mb-8 text-muted-foreground max-w-md">
          {featureList.map((feature, index) => (
            <li key={index} className="flex items-start">
              <span className="flex-shrink-0 mt-0.5">
                <Check className="h-5 w-5 text-primary mr-3" />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex justify-center pb-10">
        <Link href="/proposals/new">
          <Button
            size="lg"
            className="gap-2 font-medium transition-all hover:shadow-md focus:ring-2 focus:ring-primary/20"
          >
            <Plus className="h-5 w-5" />
            Create Your First Proposal
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

// Component - Combines Model and Presentation with added behavior
export function EmptyProposalState() {
  const handleCreateProposal = () => {
    // No direct navigation, defer to the link
    // This function can be used for tracking or other side effects
    console.log("Create proposal button clicked");
  };

  return (
    <Link href="/proposals/new" className="block w-full">
      <EmptyProposalStateView onCreateProposal={handleCreateProposal} />
    </Link>
  );
}

export default EmptyProposalState;
