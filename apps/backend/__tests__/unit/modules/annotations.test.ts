/**
 * Tests for the proposal state annotations module
 */
import { describe, it, expect } from "vitest";
import { OverallProposalStateAnnotation } from "../../modules/annotations.js";
import { SectionType } from "../../modules/types.js";
import { HumanMessage } from "@langchain/core/messages";

describe("State Annotations Module", () => {
  it("should have OverallProposalStateAnnotation defined", () => {
    expect(OverallProposalStateAnnotation).toBeDefined();
  });

  describe("Default values", () => {
    it("should provide default values for all fields", () => {
      // Get the default state by invoking the annotation's default function
      const defaultState = Object.entries(
        OverallProposalStateAnnotation.fields
      ).reduce(
        (acc, [key, annotation]) => {
          if (
            "default" in annotation &&
            typeof annotation.default === "function"
          ) {
            acc[key] = annotation.default();
          }
          return acc;
        },
        {} as Record<string, any>
      );

      // Check some key default values
      expect(defaultState.rfpDocument.status).toBe("not_started");
      expect(defaultState.sections).toBeInstanceOf(Map);
      expect(defaultState.sections.size).toBe(0);
      expect(defaultState.messages).toEqual([]);
      expect(defaultState.errors).toEqual([]);
      expect(defaultState.researchStatus).toBe("queued");
      expect(defaultState.solutionStatus).toBe("queued");
      expect(defaultState.connectionsStatus).toBe("queued");
      expect(defaultState.status).toBe("queued");
      expect(defaultState.interruptStatus.isInterrupted).toBe(false);
      expect(defaultState.interruptStatus.feedback).toBeNull();
    });
  });

  describe("Reducer behaviors", () => {
    it("should properly reduce sections via the annotation", () => {
      // Create a mock state reducer function that applies the sections annotation
      const mockSectionsReducer = (currentState: any, update: any) => {
        const sectionAnnotation =
          OverallProposalStateAnnotation.fields.sections;
        if (
          "value" in sectionAnnotation &&
          typeof sectionAnnotation.value === "function"
        ) {
          return {
            ...currentState,
            sections: sectionAnnotation.value(currentState.sections, update),
          };
        }
        return currentState;
      };

      // Initial state with empty sections
      const initialState = {
        sections: new Map(),
      };

      // Update to add a section
      const updatedState = mockSectionsReducer(initialState, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "queued",
      });

      expect(updatedState.sections.size).toBe(1);
      expect(
        updatedState.sections.get(SectionType.PROBLEM_STATEMENT).content
      ).toBe("Problem statement content");
    });

    it("should properly reduce messages via the annotation", () => {
      // Create a mock state reducer function that applies the messages annotation
      const mockMessagesReducer = (currentState: any, update: any) => {
        const messagesAnnotation =
          OverallProposalStateAnnotation.fields.messages;
        if (
          "reducer" in messagesAnnotation &&
          typeof messagesAnnotation.reducer === "function"
        ) {
          return {
            ...currentState,
            messages: messagesAnnotation.reducer(currentState.messages, update),
          };
        }
        return currentState;
      };

      // Initial state with empty messages
      const initialState = {
        messages: [],
      };

      // Update to add a message
      const updatedState = mockMessagesReducer(initialState, [
        new HumanMessage("Hello"),
      ]);

      expect(updatedState.messages.length).toBe(1);
      expect(updatedState.messages[0].content).toBe("Hello");
    });

    it("should properly reduce errors via the annotation", () => {
      // Create a mock state reducer function that applies the errors annotation
      const mockErrorsReducer = (currentState: any, update: any) => {
        const errorsAnnotation = OverallProposalStateAnnotation.fields.errors;
        if (
          "value" in errorsAnnotation &&
          typeof errorsAnnotation.value === "function"
        ) {
          return {
            ...currentState,
            errors: errorsAnnotation.value(currentState.errors, update),
          };
        }
        return currentState;
      };

      // Initial state with empty errors
      const initialState = {
        errors: [],
      };

      // Update to add an error
      const updatedState = mockErrorsReducer(initialState, "New error");

      expect(updatedState.errors.length).toBe(1);
      expect(updatedState.errors[0]).toBe("New error");
    });

    it("should properly reduce interruptStatus via the annotation", () => {
      // Create a mock state reducer function that applies the interruptStatus annotation
      const mockInterruptReducer = (currentState: any, update: any) => {
        const interruptAnnotation =
          OverallProposalStateAnnotation.fields.interruptStatus;
        if (
          "value" in interruptAnnotation &&
          typeof interruptAnnotation.value === "function"
        ) {
          return {
            ...currentState,
            interruptStatus: interruptAnnotation.value(
              currentState.interruptStatus,
              update
            ),
          };
        }
        return currentState;
      };

      // Initial state with default interruptStatus
      const initialState = {
        interruptStatus: {
          isInterrupted: false,
          interruptionPoint: null,
          feedback: null,
          processingStatus: null,
        },
      };

      // Update to change interrupt status
      const updatedState = mockInterruptReducer(initialState, {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: {
          type: "approve",
          content: "Looks good",
          timestamp: new Date().toISOString(),
        },
      });

      expect(updatedState.interruptStatus.isInterrupted).toBe(true);
      expect(updatedState.interruptStatus.interruptionPoint).toBe(
        "evaluateResearch"
      );
      expect(updatedState.interruptStatus.feedback?.type).toBe("approve");
      expect(updatedState.interruptStatus.feedback?.content).toBe("Looks good");
    });
  });
});
