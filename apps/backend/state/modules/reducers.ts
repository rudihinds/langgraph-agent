/**
 * Reducer functions for state management in the proposal generation system
 */
import { SectionType, SectionData } from "./types.js";

/**
 * Custom reducer for sections map
 * Handles merging of section data with proper immutability
 */
export function sectionsReducer(
  currentValue: Map<SectionType, SectionData> | undefined,
  newValue:
    | Map<SectionType, SectionData>
    | ({ id: SectionType } & Partial<SectionData>)
): Map<SectionType, SectionData> {
  // Initialize with current value or empty map
  const current = currentValue || new Map<SectionType, SectionData>();
  const result = new Map(current);

  // If newValue is a Partial<SectionData> with an id, it's a single section update
  if ("id" in newValue && typeof newValue.id === "string") {
    const update = newValue as { id: SectionType } & Partial<SectionData>;
    const sectionId = update.id;
    const existingSection = current.get(sectionId);

    // Create a new merged section
    const updatedSection: SectionData = existingSection
      ? { ...existingSection, ...update, lastUpdated: new Date().toISOString() }
      : {
          id: sectionId,
          content: update.content || "",
          status: update.status || "queued",
          lastUpdated: update.lastUpdated || new Date().toISOString(),
        };

    // Update the map with the new section
    result.set(sectionId, updatedSection);
    return result;
  }

  // Otherwise, it's a map to merge with
  if (newValue instanceof Map) {
    newValue.forEach((value, key) => {
      result.set(key, value);
    });
  }

  return result;
}

/**
 * Custom reducer for errors array
 * Ensures new errors are always appended
 */
export function errorsReducer(
  currentValue: string[] | undefined,
  newValue: string | string[]
): string[] {
  const current = currentValue || [];

  if (typeof newValue === "string") {
    return [...current, newValue];
  }

  return [...current, ...newValue];
}

/**
 * Reducer that always takes the last value provided.
 * Allows undefined as a valid new value, returning undefined if newValue is undefined.
 */
export function lastValueReducer<T>(
  _currentValue: T | undefined,
  newValue: T | undefined
): T | undefined {
  return newValue;
}

/**
 * Stricter "last value wins" reducer for non-optional fields.
 * Returns the current value if the new value is undefined, ensuring the field type is maintained.
 */
export function lastValueWinsReducerStrict<T>(
  currentValue: T, // Expects current value to be non-undefined too
  newValue: T | undefined
): T {
  if (newValue === undefined) {
    // Return current value when undefined is passed
    return currentValue;
  }
  return newValue;
}

/**
 * Reducer for createdAt - only takes the first value
 * Ensures creation timestamp remains unchanged
 */
export function createdAtReducer(
  currentValue: string | undefined,
  newValue: string | undefined
): string | undefined {
  return currentValue ?? newValue; // If currentValue exists, keep it; otherwise, use newValue
}

/**
 * Reducer for lastUpdatedAt - always takes the new value or current time
 * Ensures last updated timestamp is always the most recent
 */
export function lastUpdatedAtReducer(
  _currentValue: string | undefined,
  newValue: string | undefined
): string {
  return newValue ?? new Date().toISOString(); // Use newValue if provided, otherwise current time
}

/**
 * Custom reducer for interrupt status
 * Handles nested feedback object updates with proper immutability
 */
export function interruptStatusReducer<
  T extends {
    isInterrupted: boolean;
    interruptionPoint: string | null;
    feedback: {
      type: any | null;
      content: string | null;
      timestamp: string | null;
    } | null;
    processingStatus: string | null;
  },
>(current: T, newValue: Partial<T> | undefined): T {
  if (!newValue) return current;

  // Handle partial updates to nested feedback object
  let updatedFeedback = current.feedback;
  if (newValue.feedback) {
    updatedFeedback = {
      ...(current.feedback || {
        type: null,
        content: null,
        timestamp: null,
      }),
      ...newValue.feedback,
    };
  }

  return {
    ...current,
    ...newValue,
    feedback: newValue.feedback === null ? null : updatedFeedback,
  } as T;
}
