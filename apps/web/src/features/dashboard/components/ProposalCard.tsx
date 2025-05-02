"use client";

import Link from "next/link";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/features/ui/components/card";
import { Badge } from "@/features/ui/components/badge";
import { Progress } from "@/features/ui/components/progress";
import {
  BarChart,
  Calendar,
  Clock,
  MoreHorizontal,
  Pencil,
  FileText,
  Trash2,
  Building,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/features/ui/components/dropdown-menu";
import { Button } from "@/features/ui/components/button";
import { cn } from "@/lib/utils/utils";

// MODEL: Define the data structure
interface ProposalCardProps {
  proposal: {
    id: string;
    title: string;
    organization?: string;
    status: string;
    progress: number;
    createdAt: string;
    updatedAt: string;
    dueDate?: string;
    phase?: string;
  };
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onExport?: (id: string) => void;
}

// Helper functions
const getDueDateStyles = (dueDate?: string) => {
  if (!dueDate) return {};

  const now = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = differenceInDays(due, now);

  if (daysUntilDue <= 3) {
    return { className: "text-destructive font-semibold", label: "Urgent" };
  } else if (daysUntilDue <= 14) {
    return { className: "text-amber-500", label: "Approaching" };
  }

  return { className: "", label: "Due" };
};

// PRESENTATION: Render the UI
function ProposalCardView({
  proposal,
  onDelete,
  onEdit,
  onExport,
}: ProposalCardProps) {
  const status = getStatusConfig(proposal.status);
  const phase = proposal.phase || "research";
  const lastUpdated = formatDistanceToNow(new Date(proposal.updatedAt), {
    addSuffix: true,
  });

  const dueDateInfo = proposal.dueDate
    ? getDueDateStyles(proposal.dueDate)
    : null;

  const formattedDueDate = proposal.dueDate
    ? new Date(proposal.dueDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Card
      className="overflow-hidden flex flex-col transition-all hover:shadow-md"
      data-testid="proposal-card"
    >
      <CardHeader className="p-4 pb-2 space-y-1">
        <div className="flex justify-between items-start">
          <Badge variant={status.variant}>{status.label}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="More options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit?.(proposal.id)}>
                <Pencil className="mr-2 h-4 w-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.(proposal.id)}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Export</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete?.(proposal.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Link href={`/proposals/${proposal.id}`} className="block">
          <CardTitle className="line-clamp-2 hover:text-primary transition-colors">
            {proposal.title}
          </CardTitle>
        </Link>
        {proposal.organization && (
          <CardDescription className="line-clamp-1 flex items-center gap-1 mt-1">
            <Building className="h-3.5 w-3.5" />
            {proposal.organization}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-0 flex-grow">
        <div className="mt-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{proposal.progress}%</span>
          </div>
          <Progress value={proposal.progress} className="h-2" />
        </div>

        <div className="grid grid-cols-1 gap-2 mt-4">
          {dueDateInfo && (
            <div className="flex items-center text-xs justify-between">
              <div className="flex items-center">
                <Clock className="h-3.5 w-3.5 mr-1" />
                <span>{dueDateInfo.label}:</span>
              </div>
              <span
                className={cn("font-medium", dueDateInfo.className)}
                data-testid="due-date"
              >
                {formattedDueDate}
              </span>
            </div>
          )}

          <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 mr-1" />
            <span>Updated {lastUpdated}</span>
          </div>

          <div className="flex items-center text-xs text-muted-foreground justify-end">
            <BarChart className="h-3.5 w-3.5 mr-1" />
            <span>Phase: {formatPhase(phase)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 mt-auto">
        <div className="grid grid-cols-2 gap-2 w-full">
          <Link href={`/proposals/${proposal.id}`} className="w-full">
            <Button variant="secondary" className="w-full" size="sm">
              Continue
            </Button>
          </Link>
          <Link
            href={`/dashboard/chat?rfpId=${proposal.id}`}
            className="w-full"
          >
            <Button variant="outline" className="w-full" size="sm">
              Continue in Chat
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

// COMPONENT: Handle interactions
export function ProposalCard(props: ProposalCardProps) {
  const handleEdit = (id: string) => {
    props.onEdit?.(id);
  };

  const handleDelete = (id: string) => {
    props.onDelete?.(id);
  };

  const handleExport = (id: string) => {
    props.onExport?.(id);
  };

  return (
    <ProposalCardView
      proposal={props.proposal}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onExport={handleExport}
    />
  );
}

function getStatusConfig(status: string) {
  switch (status) {
    case "draft":
      return { label: "Draft", variant: "outline" as const };
    case "in_progress":
      return { label: "In Progress", variant: "default" as const };
    case "submitted":
      return { label: "Submitted", variant: "success" as const };
    case "completed":
      return { label: "Completed", variant: "success" as const };
    case "paused":
      return { label: "Paused", variant: "secondary" as const };
    case "abandoned":
      return { label: "Abandoned", variant: "destructive" as const };
    default:
      return { label: status, variant: "default" as const };
  }
}

function formatPhase(phase: string) {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}
