/**
 * Serialization helpers for LangGraph checkpoint storage
 *
 * This module provides utilities for serializing and deserializing complex objects
 * such as BaseMessages and state snapshots for storage in the Supabase database.
 */

import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { ProposalStateType } from "../state/proposalState";

/**
 * Options for serialization
 */
export interface SerializationOptions {
  /**
   * Whether to include metadata like additional_kwargs
   * @default false
   */
  includeMetadata?: boolean;
}

/**
 * Zod schema for serialized message data
 */
const SerializedMessageDataSchema = z.object({
  content: z.any(),
  additional_kwargs: z.record(z.any()).optional(),
  example: z.boolean().optional(),
  response_metadata: z.record(z.any()).optional(),
  tool_call_id: z.string().optional(),
  tool_name: z.string().optional(),
  name: z.string().optional(),
});

/**
 * Zod schema for serialized messages
 */
const SerializedMessageSchema = z.object({
  type: z.string(),
  data: SerializedMessageDataSchema,
});

export type SerializedMessage = z.infer<typeof SerializedMessageSchema>;

/**
 * Serializes a BaseMessage to a plain object for storage
 *
 * @param message The message to serialize
 * @param options Options for serialization
 * @returns A plain object representation of the message
 */
export function serializeMessage(
  message: BaseMessage,
  options: SerializationOptions = {}
): SerializedMessage {
  const { includeMetadata = false } = options;

  const serializedData: Record<string, any> = {
    content: message.content,
  };

  // Add additional properties if includeMetadata is true
  if (includeMetadata) {
    if (
      message.additional_kwargs &&
      Object.keys(message.additional_kwargs).length > 0
    ) {
      serializedData.additional_kwargs = message.additional_kwargs;
    }

    if (
      message.response_metadata &&
      Object.keys(message.response_metadata).length > 0
    ) {
      serializedData.response_metadata = message.response_metadata;
    }

    if ("example" in message && message.example !== undefined) {
      serializedData.example = message.example;
    }

    // Handle tool messages
    if (message instanceof ToolMessage) {
      if (message.tool_call_id)
        serializedData.tool_call_id = message.tool_call_id;
      if (message.name) serializedData.name = message.name;
    }

    // Handle chat messages
    if (message instanceof ChatMessage && message.name) {
      serializedData.name = message.name;
    }
  }

  return {
    type: message._getType(),
    data: serializedData,
  };
}

/**
 * Deserializes a plain object back to a BaseMessage
 *
 * @param data The serialized message data
 * @returns A BaseMessage instance
 */
export function deserializeMessage(data: SerializedMessage): BaseMessage {
  // Validate the schema
  const validated = SerializedMessageSchema.parse(data);
  const { type } = validated;
  const {
    content,
    additional_kwargs = {},
    response_metadata,
    example,
  } = validated.data;

  // Create the appropriate message type
  switch (type) {
    case "human":
      return new HumanMessage({
        content,
        additional_kwargs,
        response_metadata,
        example,
      });
    case "ai":
      return new AIMessage({
        content,
        additional_kwargs,
        response_metadata,
        example,
      });
    case "system":
      return new SystemMessage({
        content,
        additional_kwargs,
        response_metadata,
        example,
      });
    case "tool": {
      const options: Record<string, any> = {
        content,
        additional_kwargs,
        response_metadata,
        example,
      };

      // Add tool-specific properties
      if (data.data.tool_call_id) options.tool_call_id = data.data.tool_call_id;
      if (data.data.name) options.name = data.data.name;

      return new ToolMessage(options);
    }
    case "chat": {
      const options: Record<string, any> = {
        content,
        additional_kwargs,
        response_metadata,
        example,
      };

      // Add name for chat messages
      if (data.data.name) options.name = data.data.name;

      return new ChatMessage(options);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Serializes an array of BaseMessages
 *
 * @param messages The array of messages to serialize
 * @param options Options for serialization
 * @returns An array of serialized messages
 */
export function serializeMessages(
  messages: BaseMessage[],
  options: SerializationOptions = {}
): SerializedMessage[] {
  return messages.map((message) => serializeMessage(message, options));
}

/**
 * Deserializes an array of message objects
 *
 * @param data The array of serialized messages
 * @returns An array of BaseMessage instances
 */
export function deserializeMessages(data: SerializedMessage[]): BaseMessage[] {
  return data.map((item) => deserializeMessage(item));
}

/**
 * Deep traverses an object and serializes any BaseMessage instances
 *
 * @param obj The object to process
 * @param options Options for serialization
 * @returns A new object with serialized messages
 */
function deepSerializeMessages(
  obj: any,
  options: SerializationOptions = {}
): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepSerializeMessages(item, options));
  }

  if (obj instanceof BaseMessage) {
    return serializeMessage(obj, options);
  }

  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepSerializeMessages(value, options);
    }
    return result;
  }

  return obj;
}

/**
 * Deep traverses an object and deserializes any serialized message objects
 *
 * @param obj The object to process
 * @returns A new object with deserialized messages
 */
function deepDeserializeMessages(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepDeserializeMessages);
  }

  if (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    "data" in obj &&
    typeof obj.type === "string"
  ) {
    try {
      return deserializeMessage(obj as SerializedMessage);
    } catch (e) {
      // Not a valid serialized message, continue with regular object processing
    }
  }

  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepDeserializeMessages(value);
    }
    return result;
  }

  return obj;
}

/**
 * Serializes any state object for storage
 *
 * @param state The state object to serialize
 * @param options Options for serialization
 * @returns A serialized representation of the state
 */
export function serializeState<T = any>(
  state: T,
  options: SerializationOptions = {}
): any {
  return deepSerializeMessages(state, options);
}

/**
 * Deserializes state data
 *
 * @param data The serialized state data
 * @returns The deserialized state object
 */
export function deserializeState<T = any>(data: any): T {
  return deepDeserializeMessages(data);
}

/**
 * Specialized serializer for ProposalStateType
 *
 * @param state ProposalStateType instance
 * @param options Serialization options
 * @returns Serialized state
 */
export function serializeProposalState(
  state: ProposalStateType,
  options: SerializationOptions = {}
): any {
  const result: Record<string, any> = {};

  // Serialize messages if present
  if (state.messages && state.messages.length > 0) {
    result.messages = serializeMessages(state.messages, options);
  }

  // Copy other fields directly if they exist
  if (state.rfpAnalysis !== undefined) result.rfpAnalysis = state.rfpAnalysis;
  if (state.solutionSought !== undefined)
    result.solutionSought = state.solutionSought;
  if (state.connectionPairs !== undefined)
    result.connectionPairs = [...state.connectionPairs];
  if (state.proposalSections !== undefined)
    result.proposalSections = { ...state.proposalSections };
  if (state.sectionStatus !== undefined)
    result.sectionStatus = { ...state.sectionStatus };
  if (state.currentPhase !== undefined)
    result.currentPhase = state.currentPhase;
  if (state.metadata !== undefined) result.metadata = { ...state.metadata };

  return result;
}

/**
 * Specialized deserializer for ProposalStateType
 *
 * @param data Serialized state data
 * @returns ProposalStateType instance
 */
export function deserializeProposalState(data: any): ProposalStateType {
  const result: ProposalStateType = {
    messages: [],
    rfpAnalysis: null,
    solutionSought: null,
    connectionPairs: [],
    proposalSections: {},
    sectionStatus: {
      problem_statement: "not_started",
      solution: "not_started",
      organizational_capacity: "not_started",
      implementation_plan: "not_started",
      evaluation: "not_started",
      budget: "not_started",
      executive_summary: "not_started",
      conclusion: "not_started",
    },
    currentPhase: "research",
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      proposalId: "",
      userId: "",
      proposalTitle: "",
    },
  };

  // Deserialize messages if present
  if (data.messages) {
    result.messages = deserializeMessages(data.messages);
  }

  // Copy other fields directly if they exist in the serialized data
  if (data.rfpAnalysis !== undefined) result.rfpAnalysis = data.rfpAnalysis;
  if (data.solutionSought !== undefined)
    result.solutionSought = data.solutionSought;
  if (data.connectionPairs !== undefined)
    result.connectionPairs = data.connectionPairs;
  if (data.proposalSections !== undefined)
    result.proposalSections = data.proposalSections;
  if (data.sectionStatus !== undefined)
    result.sectionStatus = {
      ...result.sectionStatus,
      ...data.sectionStatus,
    };
  if (data.currentPhase !== undefined) result.currentPhase = data.currentPhase;
  if (data.metadata !== undefined)
    result.metadata = {
      ...result.metadata,
      ...data.metadata,
    };

  return result;
}
