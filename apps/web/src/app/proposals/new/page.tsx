import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "New Proposal | Proposal Agent",
  description: "Create a new proposal for your organization",
};

export default function NewProposalPage() {
  return (
    <div className="container px-4 py-6 mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Create New Proposal
          </h1>
          <p className="mt-1 text-muted-foreground">
            Start a new proposal by filling out basic information and uploading
            your RFP document
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Proposal Details</CardTitle>
            <CardDescription>
              Enter information about your proposal and the funding opportunity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Proposal Title</Label>
              <Input
                id="title"
                placeholder="Enter a meaningful title for your proposal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organization Name</Label>
              <Input
                id="organization"
                placeholder="Your organization or entity name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="funder">Funding Organization</Label>
              <Input
                id="funder"
                placeholder="Name of the organization providing funding"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Brief Description</Label>
              <Textarea
                id="description"
                placeholder="A brief description of the proposal purpose"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfp-document">RFP Document</Label>
              <div className="p-4 border rounded-md border-input">
                <div className="text-center">
                  <div className="flex mt-2 text-sm leading-6 text-muted-foreground">
                    <label
                      htmlFor="file-upload"
                      className="relative font-semibold rounded-md cursor-pointer bg-background text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/70"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    PDF, DOC, DOCX, or TXT up to 10MB
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard">Cancel</Link>
            </Button>
            <Button type="submit">Create Proposal</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
