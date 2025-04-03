import { Metadata } from "next";
import EmptyProposalState from "@/components/dashboard/EmptyProposalState";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard | Proposal Agent",
  description: "Manage your proposal drafts and submissions",
};

export default function DashboardPage() {
  return (
    <div className="container px-4 py-6 mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Proposals</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your proposal drafts, works in progress, and submissions
          </p>
        </div>
        <Link href="/proposals/new">
          <Button className="gap-1">
            <PlusIcon className="w-4 h-4" />
            New Proposal
          </Button>
        </Link>
      </div>

      <EmptyProposalState />
    </div>
  );
}
