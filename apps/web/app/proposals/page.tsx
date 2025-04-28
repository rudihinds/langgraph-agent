"use client";

import { Button } from "@/features/ui/components/button";
import Link from "next/link";

export default function ProposalsPage() {
  return (
    <div className="container px-4 py-12 mx-auto">
      <div className="max-w-3xl mx-auto">
        <h1 className="mb-8 text-3xl font-bold">Proposals Overview</h1>
        
        <div className="mb-8">
          <p className="mb-4 text-lg">
            Welcome to the Proposals section. Here you can create, manage, and track all your proposals.
          </p>
          <p className="mb-4">
            Choose one of the options below to get started.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-6 mb-12 md:grid-cols-2">
          <div className="p-6 border rounded-lg bg-card">
            <h2 className="mb-3 text-xl font-semibold">RFP Response</h2>
            <p className="mb-4 text-muted-foreground">
              Create a proposal in response to a formal Request for Proposals (RFP)
            </p>
            <Button asChild>
              <Link href="/proposals/create?type=rfp">Create RFP Response</Link>
            </Button>
          </div>
          
          <div className="p-6 border rounded-lg bg-card">
            <h2 className="mb-3 text-xl font-semibold">Application Questions</h2>
            <p className="mb-4 text-muted-foreground">
              Answer a series of application questions for a grant or funding opportunity
            </p>
            <Button asChild>
              <Link href="/proposals/create?type=application">Create Application</Link>
            </Button>
          </div>
        </div>
        
        <div className="text-center">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}