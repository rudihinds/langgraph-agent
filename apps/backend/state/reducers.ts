/**
 * Helper functions for creating type-safe immutable state updates
 */

/**
 * Helper to create a typed immutable state update
 * @param state Current state
 * @param updateFn Function that receives a draft of the state and modifies it
 * @returns New state with updates applied
 */
export function updateState<T extends Record<string, any>>(
  state: T,
  updateFn: (draft: T) => void
): T {
  // Create a shallow copy of the state
  const newState = { ...state };
  
  // Apply updates to the copy
  updateFn(newState);
  
  // Return the new state
  return newState;
}

/**
 * Update a specific field in the state immutably
 * @param state Current state
 * @param key Key to update
 * @param value New value
 * @returns New state with the updated field
 */
export function updateField<T extends Record<string, any>, K extends keyof T>(
  state: T,
  key: K,
  value: T[K]
): T {
  return {
    ...state,
    [key]: value,
  };
}

/**
 * Update a nested field in the state immutably
 * @param state Current state
 * @param path Array of keys to the nested field
 * @param value New value
 * @returns New state with the updated nested field
 */
export function updateNestedField<T extends Record<string, any>, V>(
  state: T,
  path: (string | number)[],
  value: V
): T {
  if (path.length === 0) {
    return state;
  }
  
  if (path.length === 1) {
    return {
      ...state,
      [path[0]]: value,
    };
  }
  
  const [first, ...rest] = path;
  const key = first as keyof T;
  
  return {
    ...state,
    [key]: updateNestedField(
      (state[key] as Record<string, any>) || {},
      rest,
      value
    ),
  };
}

/**
 * Merge objects immutably
 * @param target Target object
 * @param source Source object to merge
 * @returns New merged object
 */
export function mergeObjects<T extends Record<string, any>, S extends Record<string, any>>(
  target: T,
  source: S
): T & S {
  return {
    ...target,
    ...source,
  };
}

/**
 * Update an item in an array immutably
 * @param array Array to update
 * @param index Index to update
 * @param value New value
 * @returns New array with the updated item
 */
export function updateArrayItem<T>(
  array: T[],
  index: number,
  value: T
): T[] {
  if (index < 0 || index >= array.length) {
    return array;
  }
  
  return [
    ...array.slice(0, index),
    value,
    ...array.slice(index + 1),
  ];
}

/**
 * Add an item to an array immutably
 * @param array Array to update
 * @param item Item to add
 * @returns New array with the added item
 */
export function addArrayItem<T>(
  array: T[],
  item: T
): T[] {
  return [...array, item];
}

/**
 * Create specialized reducers for specific state updates
 * @returns Object containing specialized reducers
 */
export function createReducers() {
  return {
    /**
     * Update the status of a section
     * @param sectionId Section ID to update
     * @param status New status
     */
    updateSectionStatus: (sectionId: string, status: string) => ({
      sections: {
        [sectionId]: {
          id: sectionId,
          status,
          lastUpdated: new Date().toISOString(),
        },
      },
    }),
    
    /**
     * Update the content of a section
     * @param sectionId Section ID to update
     * @param content New content
     */
    updateSectionContent: (sectionId: string, content: string) => ({
      sections: {
        [sectionId]: {
          id: sectionId,
          content,
          lastUpdated: new Date().toISOString(),
        },
      },
    }),
    
    /**
     * Add an error to the state
     * @param error Error message
     */
    addError: (error: string) => ({
      errors: [error],
    }),
    
    /**
     * Update the lastUpdatedAt timestamp
     */
    updateTimestamp: () => ({
      lastUpdatedAt: new Date().toISOString(),
    }),
  };
}