import Link from "next/link";
import { Button } from "@/features/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/features/ui/components/card";
import { FileText, Plus } from "lucide-react";

export default function EmptyDashboard() {
  return (
    <Card className="w-full border-dashed">
      <CardHeader className="flex flex-col items-center pt-8 space-y-1 text-center">
        <div className="flex items-center justify-center w-12 h-12 mb-2 rounded-full bg-primary/10">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-xl">No Proposals Yet</CardTitle>
        <CardDescription className="max-w-md">
          Create your first proposal to get started. Our AI agent will guide you
          through the process of crafting an effective proposal.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center pb-2">
        <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 mr-2 text-primary"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            AI-assisted research and writing
          </li>
          <li className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 mr-2 text-primary"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            Generate persuasive content based on RFP requirements
          </li>
          <li className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 mr-2 text-primary"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            Export ready-to-submit proposals in multiple formats
          </li>
        </ul>
      </CardContent>
      <CardFooter className="flex justify-center pb-8">
        <Link href="/proposals/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create Your First Proposal
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
