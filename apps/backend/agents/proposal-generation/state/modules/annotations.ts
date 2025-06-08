userCollaboration: Annotation<UserCollaboration>({
  reducer: (currentState, newState) => {
    if (!newState) return currentState;
    return {
      ...currentState,
      ...newState,
      refinementCount: newState.refinementCount ?? currentState?.refinementCount ?? 0,
      maxRefinements: newState.maxRefinements ?? currentState?.maxRefinements ?? 3,
    };
  },
  default: () => ({
    refinementCount: 0,
    maxRefinements: 3,
  }),
}), 