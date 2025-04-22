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
    description: `Determine what action the user intends based on their message in our proposal writing workflow.
      
Our proposal generation workflow has these specific steps:
1. Load an RFP document 
2. Perform research on the RFP
3. Develop a solution approach
4. Generate and refine proposal sections

Analyze the user's message and categorize the intent into one of these commands:
- load_document: When user wants to start the process, upload an RFP, or mentions anything about providing a document 
- regenerate_section: When user wants to recreate a proposal section
- modify_section: When user wants to edit an existing section
- approve_section: When user wants to mark a section as approved
- ask_question: When user is asking a factual question unrelated to workflow actions
- help: When user asks for guidance on what to do or how the system works
- other: For general conversation or greetings

IMPORTANT WORKFLOW GUIDANCE:
- Any message about "help me write a proposal", "start a proposal", or similar should be interpreted as load_document since that's the first required step
- References to "RFP", "document", "text", or "upload" strongly suggest load_document
- Saying things like "I want to write a proposal for X" indicates load_document intent
- Even vague statements about wanting proposal help should default to load_document if it's not clear what specific action they want

Also extract the following (when applicable):
- target_section: The specific section of the proposal being referenced (e.g., "executive summary", "problem statement")
- request_details: Additional context or specifics about their request, especially any RFP ID or text they provide

Analyze carefully to determine the most accurate intent and provide all relevant details.`,
    schema: z.object({ userMessage: z.string() }),
  }
);
