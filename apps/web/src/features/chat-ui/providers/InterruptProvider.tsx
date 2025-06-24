"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
} from "react";
import { toast } from "sonner";

import { useStreamContext } from "./StreamProvider";
import { InterruptResponse } from "../types";

interface InterruptContextType {
  isInterrupted: boolean;
  interruptState: InterruptResponse | null;
  setInterrupted: (interrupted: boolean) => void;
  setInterruptState: (state: InterruptResponse | null) => void;
  handleInterrupt: (state: InterruptResponse) => void;
  handleApprove: () => Promise<void>;
  handleRevise: (feedback: string) => Promise<void>;
  handleRegenerate: () => Promise<void>;
  loading: boolean;
}

const InterruptContext = createContext<InterruptContextType | undefined>(
  undefined
);

export function InterruptProvider({ children }: { children: ReactNode }) {
  const { submit, threadId, interrupt } = useStreamContext();
  const [isInterrupted, setInterrupted] = useState(false);
  const [interruptState, setInterruptState] =
    useState<InterruptResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Handle an interrupt event
  const handleInterrupt = useCallback((state: InterruptResponse) => {
    setInterrupted(true);
    setInterruptState(state);
    // You could also play a sound or show a notification here
  }, []);

  // Handle user approving the current content - LangGraph SDK compliant
  const handleApprove = useCallback(async () => {
    if (!interruptState || !threadId) {
      toast.error("No interrupt state found");
      return;
    }

    setLoading(true);
    try {
      // Use LangGraph SDK resume pattern
      await submit(undefined, { 
        command: { 
          resume: "approve" 
        } 
      });

      // Clear interrupt state after approval
      setInterrupted(false);
      setInterruptState(null);
      toast.success("Content approved");
    } catch (error) {
      console.error("Error approving content:", error);
      toast.error("Failed to approve content", {
        description: "Please try again later",
      });
    } finally {
      setLoading(false);
    }
  }, [interruptState, threadId, submit]);

  // Handle user providing revision feedback - LangGraph SDK compliant
  const handleRevise = useCallback(
    async (feedback: string) => {
      if (!interruptState || !threadId || !feedback.trim()) {
        toast.error("Please provide feedback for revision");
        return;
      }

      setLoading(true);
      try {
        // Use LangGraph SDK resume pattern with feedback
        await submit(undefined, { 
          command: { 
            resume: { action: "modify", feedback: feedback.trim() } 
          } 
        });

        // Clear interrupt state after revision
        setInterrupted(false);
        setInterruptState(null);
        toast.success("Revision feedback submitted");
      } catch (error) {
        console.error("Error submitting revision:", error);
        toast.error("Failed to submit revision", {
          description: "Please try again later",
        });
      } finally {
        setLoading(false);
      }
    },
    [interruptState, threadId, submit]
  );

  // Handle user requesting complete regeneration - LangGraph SDK compliant
  const handleRegenerate = useCallback(async () => {
    if (!interruptState || !threadId) {
      toast.error("No interrupt state found");
      return;
    }

    setLoading(true);
    try {
      // Use LangGraph SDK resume pattern for rejection/regeneration
      await submit(undefined, { 
        command: { 
          resume: "reject" 
        } 
      });

      // Clear interrupt state after regeneration request
      setInterrupted(false);
      setInterruptState(null);
      toast.success("Regeneration requested");
    } catch (error) {
      console.error("Error requesting regeneration:", error);
      toast.error("Failed to request regeneration", {
        description: "Please try again later",
      });
    } finally {
      setLoading(false);
    }
  }, [interruptState, threadId, submit]);

  // Create the context value with all the interrupt-related state and functions
  const contextValue = {
    isInterrupted,
    interruptState,
    setInterrupted,
    setInterruptState,
    handleInterrupt,
    handleApprove,
    handleRevise,
    handleRegenerate,
    loading,
  };

  return (
    <InterruptContext.Provider value={contextValue}>
      {children}
    </InterruptContext.Provider>
  );
}

export function useInterrupt() {
  const context = useContext(InterruptContext);
  if (context === undefined) {
    throw new Error("useInterrupt must be used within an InterruptProvider");
  }
  return context;
}
