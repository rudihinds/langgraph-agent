import { Message, Role } from "../../features/chat-ui/types/index";

/**
 * Types of agent interrupts
 */
export enum InterruptType {
  HUMAN_FEEDBACK = "human_feedback",
  APPROVAL_REQUIRED = "approval_required",
  REVISION_OPPORTUNITY = "revision_opportunity",
}

export interface InterruptData {
  type: InterruptType;
  reason: string;
  sectionContent?: string;
  sectionId?: string;
  options?: string[];
  title?: string;
}

/**
 * Check if a message is an interrupt message
 * @param message The message to check
 * @returns True if the message is an interrupt, false otherwise
 */
export function isInterruptMessage(message: Message): boolean {
  if (message.role !== Role.ASSISTANT) return false;

  // Check for structured interrupt metadata
  if (message.metadata?.isInterrupt) return true;

  // Check content patterns if no explicit metadata
  return hasInterruptPatterns(message.content);
}

/**
 * Check if a message content contains interrupt patterns
 * @param content The message content to check
 * @returns True if the content contains interrupt patterns, false otherwise
 */
export function hasInterruptPatterns(content: string): boolean {
  const interruptPatterns = [
    // Approval request patterns
    /\b(need|requires?|waiting for|request) (your|human) (approval|feedback|input|review)\b/i,
    /\b(please|kindly) (approve|review|provide feedback)\b/i,
    /\[waiting for (approval|confirmation|review)\]/i,

    // Question patterns
    /\bwould you like me to\b.+\?/i,
    /\bdo you (want|prefer)\b.+\?/i,
    /\bshould I (continue|proceed)\b.+\?/i,

    // Choice patterns
    /\b(option|alternative)s? (available|to consider)\b/i,
    /\b(you can|you may) (choose|select) (between|from)\b/i,

    // Explicit interruption markers
    /\[interrupt\]/i,
    /\binterrupt:/i,
    /\bhuman input required\b/i,
    /\breview required\b/i,
  ];

  return interruptPatterns.some((pattern) => pattern.test(content));
}

/**
 * Extract interrupt data from a message
 * @param message The message to extract interrupt data from
 * @returns InterruptData if successfully extracted, null otherwise
 */
export function extractInterruptData(message: Message): InterruptData | null {
  // Check for structured interrupt data
  if (message.metadata?.interruptData) {
    return message.metadata.interruptData as InterruptData;
  }

  // Try to parse JSON interrupt data from the message content
  const jsonMatch = message.content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      if (
        jsonData.type &&
        Object.values(InterruptType).includes(jsonData.type) &&
        jsonData.reason
      ) {
        return jsonData as InterruptData;
      }
    } catch (e) {
      console.warn("Failed to parse JSON interrupt data", e);
    }
  }

  // Fallback to heuristics for identifying interrupt type
  if (hasInterruptPatterns(message.content)) {
    // Determine type based on content patterns
    let type = InterruptType.HUMAN_FEEDBACK;

    if (/\b(approv(e|al)|confirm|proceed)\b/i.test(message.content)) {
      type = InterruptType.APPROVAL_REQUIRED;
    } else if (
      /\b(revis(e|ion)|feedback|suggest|improv(e|ement))\b/i.test(
        message.content
      )
    ) {
      type = InterruptType.REVISION_OPPORTUNITY;
    }

    // Extract potential options
    const options = extractOptions(message.content);

    return {
      type,
      reason: "Agent requested human input",
      options: options.length > 0 ? options : undefined,
      title: extractTitle(message.content),
    };
  }

  return null;
}

/**
 * Extract options from message content
 * @param content The message content
 * @returns Array of options
 */
function extractOptions(content: string): string[] {
  const options: string[] = [];

  // Match numbered or bulleted lists
  const listMatches = content.match(/(?:^|\n)(?:\d+\.|\*|-)\s*(.+)(?:\n|$)/g);
  if (listMatches) {
    listMatches.forEach((match) => {
      const cleaned = match.trim().replace(/^(?:\d+\.|\*|-)\s*/, "");
      options.push(cleaned);
    });
  }

  // If no list matches, look for "Option 1:", "Option 2:" patterns
  if (options.length === 0) {
    const optionMatches = content.match(
      /(?:^|\n)(?:Option|Alternative)\s*\w+\s*:?\s*(.+)(?:\n|$)/gi
    );
    if (optionMatches) {
      optionMatches.forEach((match) => {
        const cleaned = match
          .trim()
          .replace(/^(?:Option|Alternative)\s*\w+\s*:?\s*/i, "");
        options.push(cleaned);
      });
    }
  }

  return options;
}

/**
 * Extract a potential title from message content
 * @param content The message content
 * @returns Extracted title or undefined
 */
function extractTitle(content: string): string | undefined {
  // Look for section titles or headers
  const headerMatch = content.match(/^#\s*(.+)$|^(?:\*\*|__)(.+)(?:\*\*|__)$/m);
  if (headerMatch) {
    return (headerMatch[1] || headerMatch[2]).trim();
  }

  // Fallback to first line if it's short
  const firstLine = content.split("\n")[0].trim();
  if (
    firstLine.length > 0 &&
    firstLine.length < 100 &&
    !firstLine.endsWith("?")
  ) {
    return firstLine;
  }

  return undefined;
}

/**
 * Create a structured interrupt message
 * @param type The type of interrupt
 * @param reason The reason for the interrupt
 * @param options Optional parameters
 * @returns A message with interrupt metadata
 */
export function createInterruptMessage(
  type: InterruptType,
  reason: string,
  options?: {
    sectionContent?: string;
    sectionId?: string;
    choices?: string[];
    title?: string;
  }
): Message {
  const interruptData: InterruptData = {
    type,
    reason,
    ...options,
    options: options?.choices,
  };

  let content = `**${options?.title || "Agent Interrupted"}**\n\n${reason}`;

  if (options?.choices && options.choices.length > 0) {
    content += "\n\nOptions:\n";
    options.choices.forEach((choice, index) => {
      content += `\n${index + 1}. ${choice}`;
    });
  }

  if (options?.sectionContent) {
    content += "\n\n```\n" + options.sectionContent + "\n```";
  }

  return {
    id: `interrupt-${Date.now()}`,
    role: Role.ASSISTANT,
    content,
    createdAt: new Date(),
    metadata: {
      isInterrupt: true,
      interruptData,
    },
  };
}

/**
 * Format a user response to an interrupt
 * @param type The type of response ('approval', 'revision', 'regenerate')
 * @param content Any additional content for the response
 * @returns Object with response details
 */
export function formatInterruptResponse(
  type: "approval" | "revision" | "regenerate",
  content?: string | null
): { type: string; content: string | null } {
  return {
    type,
    content: content || null,
  };
}
