import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { constructOpenInStudioURL } from "../../utils/agent-inbox-utils";
import { ExternalLink } from "lucide-react";

interface ThreadActionsViewProps {
  threadId: string;
  deploymentUrl: string;
}

export function ThreadActionsView(props: ThreadActionsViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(props.threadId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const studioURL = constructOpenInStudioURL(
    props.deploymentUrl,
    props.threadId
  );

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Thread Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className="text-xs h-8"
          >
            {copied ? "Copied!" : "Copy Thread ID"}
          </Button>
          <a
            href={studioURL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <Button
              variant="outline"
              size="sm"
              className="flex flex-row items-center gap-1 text-xs h-8"
            >
              <span>Open in LangSmith</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </div>
        <Separator />
      </CardContent>
    </Card>
  );
}
