import React, { useEffect, useRef, useState } from "react";
import { HumanInterrupt } from "@langchain/langgraph/prebuilt";
import { ArrowUp, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import {
  createDefaultHumanResponse,
  prettifyText,
} from "../../utils/agent-inbox-utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StateView } from "./state-view";
import { ThreadActionsView } from "./thread-actions-view";
import { ThreadId } from "./thread-id";
import { InboxItemInput } from "./inbox-item-input";
import { HumanResponseWithEdits, SubmitType } from "../../types";
import { GenericInterruptView } from "../messages/generic-interrupt";
import { motion, AnimatePresence } from "framer-motion";

interface AgentInboxViewProps {
  interrupts: HumanInterrupt[];
  onSubmit: (
    interrupt: HumanInterrupt,
    response: unknown,
    type: string
  ) => void;
  onDiscard: (interrupt: HumanInterrupt) => void;
  threadId: string;
  deploymentUrl: string;
  state?: Record<string, unknown>;
}

function InterruptIconComponent({ interrupt }: { interrupt: HumanInterrupt }) {
  const actionName = interrupt.action_request
    ? interrupt.action_request.type
    : "Unknown";

  return (
    <div className="bg-primary-foreground border-input flex h-10 w-10 items-center justify-center rounded-full border">
      <ArrowUp className="h-5 w-5 text-primary" />
    </div>
  );
}

function AgentInboxItemView({
  interrupt,
  onSubmit,
  onDiscard,
  index,
}: {
  interrupt: HumanInterrupt;
  onSubmit: (
    interrupt: HumanInterrupt,
    response: unknown,
    type: string
  ) => void;
  onDiscard: (interrupt: HumanInterrupt) => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const initialHumanInterruptEditValue = useRef<Record<string, string>>({});
  const [disableEdits, setDisableEdits] = useState(false);
  const [disableInput, setDisableInput] = useState(false);

  const { responses, defaultSubmitType, hasAccept } =
    createDefaultHumanResponse(interrupt, initialHumanInterruptEditValue);

  const [selectedResponseType, setSelectedResponseType] = useState<
    SubmitType | undefined
  >(defaultSubmitType);

  const activeResponse = responses.find(
    (response) => response.type === selectedResponseType
  );

  const handleResponseTypeSelect = (type: SubmitType) => {
    setSelectedResponseType(type);
  };

  const handleSubmit = (
    value: string | Record<string, unknown>,
    type: string
  ) => {
    setDisableEdits(true);
    setDisableInput(true);
    onSubmit(interrupt, value, type);
  };

  const handleDiscard = () => {
    onDiscard(interrupt);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <div className="flex flex-row items-center gap-3">
          <InterruptIconComponent interrupt={interrupt} />
          <div className="flex flex-col">
            <CardTitle className="text-sm">
              {prettifyText(interrupt.action_request?.type || "Action")}
            </CardTitle>
          </div>
        </div>
        <div className="flex flex-row items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDiscard}
            aria-label="Discard interrupt"
          >
            <Trash2 className="h-4 w-4 text-gray-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </Button>
        </div>
      </CardHeader>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <CardContent className="p-3 pt-0">
              <div className="flex w-full flex-col gap-4">
                <GenericInterruptView interrupt={interrupt.action_request} />
                {responses.length > 1 && (
                  <div className="flex w-full flex-row flex-wrap gap-2">
                    {responses.map((response) => (
                      <Button
                        key={response.type}
                        size="sm"
                        variant={
                          selectedResponseType === response.type
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          handleResponseTypeSelect(response.type as SubmitType)
                        }
                        className="text-xs h-8"
                        disabled={disableInput}
                      >
                        {prettifyText(response.type)}
                      </Button>
                    ))}
                  </div>
                )}
                {activeResponse && (
                  <div className="rounded-md border border-gray-200 p-2">
                    <InboxItemInput
                      initialValue={activeResponse.args ?? ""}
                      inputType={activeResponse.type as SubmitType}
                      hasAccept={hasAccept}
                      editsMade={
                        !!(activeResponse as HumanResponseWithEdits).editsMade
                      }
                      onSubmit={(value) =>
                        handleSubmit(value, activeResponse.type)
                      }
                      disableEdits={disableEdits}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function AgentInbox({
  interrupts,
  onSubmit,
  onDiscard,
  threadId,
  deploymentUrl,
  state,
}: AgentInboxViewProps) {
  const [stateVisible, setStateVisible] = useState(false);

  if (!interrupts || interrupts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-4",
        "rounded-xl bg-gray-50 p-4 shadow-lg"
      )}
    >
      <div className="flex flex-row items-center justify-between">
        <h2 className="text-lg font-semibold">Agent Inbox</h2>
        <div className="flex flex-row items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStateVisible((prev) => !prev)}
            className="h-8 text-xs"
          >
            {stateVisible ? "Hide State" : "View State"}
          </Button>
        </div>
      </div>
      <div className="flex w-full flex-row items-center gap-2">
        <div className="text-xs font-medium text-gray-500">Thread ID:</div>
        <ThreadId threadId={threadId} />
      </div>
      <div className="flex flex-row gap-4">
        <div className="flex w-full flex-col gap-4">
          {interrupts.map((interrupt, idx) => (
            <AgentInboxItemView
              key={`interrupt-${idx}-${interrupt.action_request.type}`}
              interrupt={interrupt}
              onSubmit={onSubmit}
              onDiscard={onDiscard}
              index={idx}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ThreadActionsView threadId={threadId} deploymentUrl={deploymentUrl} />
      </div>
      <AnimatePresence>
        {stateVisible && state && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <StateView
              stateObject={state}
              onClose={() => setStateVisible(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
