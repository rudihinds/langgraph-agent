import { Suspense } from "react";
import { ProposalCard } from "@/features/dashboard/components/ProposalCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/features/ui/components/tabs";
import EmptyDashboard from "@/features/dashboard/components/EmptyDashboard";
import DashboardSkeleton from "@/features/dashboard/components/DashboardSkeleton";
import { getProposals } from "@/features/api/utils/proposals";

export default async function ProposalList() {
  const proposals = await getProposals();

  if (!proposals || proposals.length === 0) {
    return <EmptyDashboard />;
  }

  // Group proposals by status
  const active = proposals.filter(
    (p) => p.status !== "completed" && p.status !== "abandoned"
  );
  const completed = proposals.filter((p) => p.status === "completed");
  const drafts = proposals.filter((p) => p.status === "draft");

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="all">All ({proposals.length})</TabsTrigger>
        <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
        <TabsTrigger value="completed">
          Completed ({completed.length})
        </TabsTrigger>
        <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {proposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="active" className="mt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {active.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground py-8">
              No active proposals found.
            </p>
          ) : (
            active.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))
          )}
        </div>
      </TabsContent>

      <TabsContent value="completed" className="mt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {completed.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground py-8">
              No completed proposals found.
            </p>
          ) : (
            completed.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))
          )}
        </div>
      </TabsContent>

      <TabsContent value="drafts" className="mt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drafts.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground py-8">
              No draft proposals found.
            </p>
          ) : (
            drafts.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
