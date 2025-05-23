import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Central command schema shared between tool and agent
// Added .describe() to fields for better LLM understanding
export const commandSchema = z.object({
  command: z
    .enum([
      "regenerate_section",
      "modify_section",
      "approve_section",
      "ask_question",
      "load_document",
      "help",
      "other",
    ])
    .describe("The specific command corresponding to the user'''s intent."),
  target_section: z
    .string()
    .optional()
    .describe(
      "The specific proposal section the user is referring to (e.g., '''executive_summary''')."
    ),
  request_details: z
    .string()
    .optional()
    .describe(
      "Any specific details from the user'''s request, like text to add, document content, or the question asked."
    ),
});

export type CommandSchemaType = z.infer<typeof commandSchema>;

// The OLD tool definition expected the LLM to just get userMessage
// and the tool's description guided the LLM on how to structure the output.
// The NEW approach defines the *expected structured output* as the INPUT schema for the tool call itself.
// The LLM uses the description and this schema to generate the arguments directly.

export const interpretIntentTool = tool(
  // The function now simply receives the structured arguments generated by the LLM.
  // In this case, the tool doesn't need to *do* much besides return the interpreted command,
  // as the LLM has already done the interpretation work to generate these args.
  async (input: CommandSchemaType): Promise<CommandSchemaType> => {
    console.log("interpretIntentTool invoked with LLM-generated args:", input);
    // Return the structured object directly. The LLM generated this based on the schema.
    // Add basic validation or logging if needed.
    return {
      command: input.command,
      target_section: input.target_section,
      request_details: input.request_details,
    };
  },
  {
    name: "interpret_intent",
    description: `Analyze the user'''s message regarding a proposal writing task and determine the primary command and relevant details.

Available commands are:
- load_document: User wants to provide/upload/load an RFP or document text. Extract any provided text/ID into request_details.
- regenerate_section: User wants to regenerate a specific section. Extract section name into target_section.
- modify_section: User wants to edit/change a specific section. Extract section name into target_section and modification details into request_details.
- approve_section: User approves a specific section. Extract section name into target_section.
- ask_question: User asks a question. Extract the question into request_details.
- help: User asks for help.
- other: For greetings, general chat, or unrecognized intents. Extract the user message into request_details.

Provide the determined command and any extracted target_section or request_details.`,
    // **CRITICAL CHANGE**: The schema now defines the STRUCTURE the LLM should GENERATE AS ARGUMENTS
    schema: commandSchema, // Use the commandSchema as the expected input arguments structure for the tool call
  }
);
