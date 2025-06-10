interface AgentLoadingStateProps {
  isWorking: boolean;
  context?: "rfp" | "general" | null;
  className?: string;
}

/**
 * Generic loading state component for agent activity
 *
 * Shows a spinner and context-appropriate message when the agent is processing.
 * Works universally across all agent tasks (RFP analysis, document generation, etc.)
 *
 * @param isWorking - Whether to show the loading state
 * @param context - Optional context for specific messaging ('rfp', 'general', or null)
 * @param className - Optional CSS classes for styling
 */
export const AgentLoadingState = ({
  isWorking,
  context = "general",
  className = "",
}: AgentLoadingStateProps) => {
  if (!isWorking) return null;

  const getMessage = () => {
    switch (context) {
      case "rfp":
        return "Analyzing your RFP document...";
      case "general":
      default:
        return "Processing your request...";
    }
  };

  return (
    <div className={`flex items-center gap-2 text-slate-500 ${className}`}>
      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
      <span>{getMessage()}</span>
    </div>
  );
};
