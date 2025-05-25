import { OverallProposalState } from "../state/modules/types.js";

/**
 * Options for state serialization and pruning
 */
interface SerializationOptions {
  /** Maximum number of messages to keep in history */
  maxMessageHistory?: number;
  /** Whether to trim large content */
  trimLargeContent?: boolean;
  /** Maximum size for content before trimming (in chars) */
  maxContentSize?: number;
  /** Debug mode to log serialization details */
  debug?: boolean;
}

const DEFAULT_OPTIONS: SerializationOptions = {
  maxMessageHistory: 50,
  trimLargeContent: true,
  maxContentSize: 10000,
  debug: false,
};

/**
 * Serializes the proposal state for storage in the database
 * Handles pruning and size optimization
 *
 * @param state - The state to serialize
 * @param options - Serialization options
 * @returns Serialized state as a JSON-compatible object
 */
export function serializeProposalState(
  state: OverallProposalState,
  options: SerializationOptions = {}
): Record<string, any> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.debug) {
    console.log("[StateSerializer] Serializing state", {
      stateKeys: Object.keys(state),
      options: opts,
    });
  }

  // Create a deep copy of the state to avoid modifying the original
  const stateCopy = JSON.parse(JSON.stringify(state));

  // Prune message history if needed
  if (
    stateCopy.messages &&
    stateCopy.messages.length > opts.maxMessageHistory!
  ) {
    if (opts.debug) {
      console.log(
        `[StateSerializer] Pruning message history from ${stateCopy.messages.length} to ${opts.maxMessageHistory}`
      );
    }

    // Keep first 5 messages (context setup) and last N-5 messages
    const firstMessages = stateCopy.messages.slice(0, 5);
    const lastMessages = stateCopy.messages.slice(
      -(opts.maxMessageHistory! - 5)
    );
    stateCopy.messages = [...firstMessages, ...lastMessages];
  }

  // Trim large content in messages if enabled
  if (opts.trimLargeContent && stateCopy.messages) {
    for (const message of stateCopy.messages) {
      if (
        typeof message.content === "string" &&
        message.content.length > opts.maxContentSize!
      ) {
        message.content =
          message.content.substring(0, opts.maxContentSize!) +
          `... [Trimmed ${message.content.length - opts.maxContentSize!} characters]`;
      }
    }
  }

  // Handle special case for rfpDocument (trim if too large)
  if (
    stateCopy.rfpDocument &&
    typeof stateCopy.rfpDocument === "string" &&
    stateCopy.rfpDocument.length > opts.maxContentSize!
  ) {
    const originalLength = stateCopy.rfpDocument.length;
    stateCopy.rfpDocument =
      stateCopy.rfpDocument.substring(0, opts.maxContentSize!) +
      `... [Trimmed ${originalLength - opts.maxContentSize!} characters]`;

    if (opts.debug) {
      console.log(
        `[StateSerializer] Trimmed rfpDocument from ${originalLength} to ${opts.maxContentSize} chars`
      );
    }
  }

  // Ensure JSON compatibility for all values
  return ensureJsonCompatible(stateCopy);
}

/**
 * Deserializes state from database storage
 *
 * @param serializedState - The serialized state from the database
 * @returns Reconstructed state object
 */
export function deserializeProposalState(
  serializedState: Record<string, any>
): OverallProposalState {
  // Basic deserialization is just parsing the JSON
  // Add special handling here if needed in the future

  return serializedState as OverallProposalState;
}

/**
 * Ensures an object is JSON compatible by converting non-serializable values
 *
 * @param obj - The object to make JSON compatible
 * @returns JSON compatible object
 */
function ensureJsonCompatible(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (obj instanceof Set) {
    return Array.from(obj);
  }

  if (obj instanceof Map) {
    return Object.fromEntries(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(ensureJsonCompatible);
  }

  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      result[key] = ensureJsonCompatible(value);
    }

    return result;
  }

  // All other primitive values are JSON compatible
  return obj;
}
