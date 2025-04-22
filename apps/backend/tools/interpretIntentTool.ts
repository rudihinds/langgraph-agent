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
    description:
      "Determine what action the user intends based on their message",
    schema: z.object({ userMessage: z.string() }),
  }
);
