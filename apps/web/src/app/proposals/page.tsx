"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ProposalsPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Proposals Overview</h1>
        
        <div className="mb-8">
          <p className="text-lg mb-4">
            Welcome to the Proposals section. Here you can create, manage, and track all your proposals.
          </p>
          <p className="mb-4">
            Choose one of the options below to get started.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-3">RFP Response</h2>
            <p className="text-muted-foreground mb-4">
              Create a proposal in response to a formal Request for Proposals (RFP)
            </p>
            <Button asChild>
              <Link href="/proposals/create?type=rfp">Create RFP Response</Link>
            </Button>
          </div>
          
          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-3">Application Questions</h2>
            <p className="text-muted-foreground mb-4">
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