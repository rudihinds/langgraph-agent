import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Central command schema shared between tool and agent
export const commandSchema = z.object({
  command: z.enum([
    "regenerate_section",
    "modify_section",
    "approve_section",
    "ask_question",
    "load_document",
    "help",
    "other",
  ]),
  target_section: z.string().optional(),
  request_details: z.string().optional(),
});

export type CommandSchemaType = z.infer<typeof commandSchema>;

export const interpretIntentTool = tool(
  async ({
    userMessage,
  }: {
    userMessage: string;
  }): Promise<CommandSchemaType> => {
    // Implementation for non-LLM tool calling environments
    // Default to the 'other' command since we don't actually parse here
    // (The LLM will override this with its own reasoning when called)
    return {
      command: "other",
      request_details: userMessage,
    };
  },
  {
    name: "interpret_intent",
    description: `Determine what action the user intends based on their message in a proposal writing context.
      
Analyze the user's message and categorize the intent into one of these commands:
- regenerate_section: When user wants to recreate or generate a proposal section from scratch
- modify_section: When user wants to edit or change an existing section
- approve_section: When user wants to mark a section as complete or approved
- ask_question: When user is asking a question about proposal writing or the system
- load_document: When user wants to upload or use a document
- help: When user asks for general help, guidance, or explanation of capabilities
- other: For general conversation, greetings, or intents that don't fit above categories

Also extract the following (when applicable):
- target_section: The specific section of the proposal being referenced (e.g., "executive summary", "problem statement")
- request_details: Additional context or specifics about their request

Analyze carefully to determine the most accurate intent and provide all relevant details.`,
    schema: z.object({ userMessage: z.string() }),
  }
);
