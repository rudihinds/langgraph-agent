"use client";

import { useState } from "react";
import { ProposalGrid } from "@/components/dashboard/ProposalGrid";

const mockProposals = [
  {
    id: "1",
    title: "Grant Application for Community Health Initiative",
    organization: "Health Foundation",
    status: "draft",
    progress: 25,
    createdAt: "2023-04-01T12:00:00Z",
    updatedAt: "2023-04-02T12:00:00Z",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    phase: "research",
  },
  {
    id: "2",
    title: "RFP Response for School District Technology Upgrade",
    organization: "Local School District",
    status: "in_progress",
    progress: 60,
    createdAt: "2023-03-15T12:00:00Z",
    updatedAt: "2023-04-01T12:00:00Z",
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now (approaching)
    phase: "writing",
  },
  {
    id: "3",
    title: "Urban Development Funding Proposal",
    organization: "City Planning Department",
    status: "submitted",
    progress: 100,
    createdAt: "2023-02-10T12:00:00Z",
    updatedAt: "2023-03-01T12:00:00Z",
    dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago (past due)
    phase: "completed",
  },
  {
    id: "4",
    title: "Renewable Energy Research Grant",
    organization: "Environmental Foundation",
    status: "in_progress",
    progress: 45,
    createdAt: "2023-03-20T12:00:00Z",
    updatedAt: "2023-03-25T12:00:00Z",
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now (urgent)
    phase: "research",
  },
  {
    id: "5",
    title: "Social Service Program Expansion Proposal",
    organization: "Community Services Nonprofit",
    status: "draft",
    progress: 15,
    createdAt: "2023-04-05T12:00:00Z",
    updatedAt: "2023-04-06T12:00:00Z",
    dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days from now
    phase: "planning",
  },
  {
    id: "6",
    title: "AI for Education Technology Development Proposal",
    organization: "Education Innovation Fund",
    status: "paused",
    progress: 35,
    createdAt: "2023-02-15T12:00:00Z",
    updatedAt: "2023-03-10T12:00:00Z",
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now (approaching)
    phase: "research",
  },
];

export default function ProposalsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [proposals, setProposals] = useState(mockProposals);

  const handleEdit = (id: string) => {
    console.log(`Edit proposal ${id}`);
  };

  const handleDelete = (id: string) => {
    console.log(`Delete proposal ${id}`);
    // Simulate deletion
    setProposals((prev) => prev.filter((p) => p.id !== id));
  };

  const handleExport = (id: string) => {
    console.log(`Export proposal ${id}`);
  };

  const toggleLoading = () => {
    setIsLoading((prev) => !prev);
  };

  const resetProposals = () => {
    setProposals(mockProposals);
  };

  const clearProposals = () => {
    setProposals([]);
  };

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Your Proposals</h1>
        <div className="flex gap-2">
          <button
            onClick={toggleLoading}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            {isLoading ? "Show Content" : "Show Loading"}
          </button>
          <button
            onClick={resetProposals}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Reset
          </button>
          <button
            onClick={clearProposals}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Clear All
          </button>
        </div>
      </div>

      <ProposalGrid
        proposals={proposals}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExport={handleExport}
      />
    </div>
  );
}
