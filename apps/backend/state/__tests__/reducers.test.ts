/**
 * Tests for the reducer utility functions
 */
import {
  updateState,
  updateField,
  updateNestedField,
  mergeObjects,
  updateArrayItem,
  addArrayItem,
  createReducers,
} from "../reducers";

describe("Reducer Utilities", () => {
  describe("updateState", () => {
    it("should update state immutably", () => {
      const state = { a: 1, b: 2 };
      
      const newState = updateState(state, (draft) => {
        draft.a = 3;
      });
      
      expect(newState).not.toBe(state);
      expect(newState.a).toBe(3);
      expect(newState.b).toBe(2);
      expect(state.a).toBe(1); // Original unchanged
    });
  });
  
  describe("updateField", () => {
    it("should update a field immutably", () => {
      const state = { a: 1, b: 2 };
      
      const newState = updateField(state, "a", 3);
      
      expect(newState).not.toBe(state);
      expect(newState.a).toBe(3);
      expect(state.a).toBe(1); // Original unchanged
    });
  });
  
  describe("updateNestedField", () => {
    it("should update a nested field immutably", () => {
      const state = {
        a: 1,
        b: {
          c: {
            d: 2,
          },
        },
      };
      
      const newState = updateNestedField(state, ["b", "c", "d"], 3);
      
      expect(newState).not.toBe(state);
      expect(newState.b).not.toBe(state.b);
      expect(newState.b.c).not.toBe(state.b.c);
      expect(newState.b.c.d).toBe(3);
      expect(state.b.c.d).toBe(2); // Original unchanged
    });
    
    it("should handle missing nested objects", () => {
      const state = { a: 1 };
      
      const newState = updateNestedField(state, ["b", "c"], 2);
      
      expect(newState.b).toEqual({ c: 2 });
    });
    
    it("should return same state for empty path", () => {
      const state = { a: 1 };
      
      const newState = updateNestedField(state, [], 2);
      
      expect(newState).toBe(state);
    });
  });
  
  describe("mergeObjects", () => {
    it("should merge objects immutably", () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      
      const result = mergeObjects(target, source);
      
      expect(result).not.toBe(target);
      expect(result).not.toBe(source);
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });
  });
  
  describe("updateArrayItem", () => {
    it("should update an array item immutably", () => {
      const array = [1, 2, 3];
      
      const newArray = updateArrayItem(array, 1, 4);
      
      expect(newArray).not.toBe(array);
      expect(newArray).toEqual([1, 4, 3]);
    });
    
    it("should return same array for invalid index", () => {
      const array = [1, 2, 3];
      
      const newArray = updateArrayItem(array, 3, 4);
      
      expect(newArray).toBe(array);
    });
  });
  
  describe("addArrayItem", () => {
    it("should add an item immutably", () => {
      const array = [1, 2, 3];
      
      const newArray = addArrayItem(array, 4);
      
      expect(newArray).not.toBe(array);
      expect(newArray).toEqual([1, 2, 3, 4]);
    });
  });
  
  describe("createReducers", () => {
    it("should create specialized section status reducer", () => {
      const reducers = createReducers();
      const result = reducers.updateSectionStatus("introduction", "approved");
      
      expect(result.sections.introduction.id).toBe("introduction");
      expect(result.sections.introduction.status).toBe("approved");
      expect(result.sections.introduction.lastUpdated).toBeDefined();
    });
    
    it("should create specialized section content reducer", () => {
      const reducers = createReducers();
      const result = reducers.updateSectionContent("introduction", "New content");
      
      expect(result.sections.introduction.id).toBe("introduction");
      expect(result.sections.introduction.content).toBe("New content");
      expect(result.sections.introduction.lastUpdated).toBeDefined();
    });
    
    it("should create specialized error reducer", () => {
      const reducers = createReducers();
      const result = reducers.addError("Something went wrong");
      
      expect(result.errors).toEqual(["Something went wrong"]);
    });
    
    it("should create timestamp updater", () => {
      const reducers = createReducers();
      const result = reducers.updateTimestamp();
      
      expect(result.lastUpdatedAt).toBeDefined();
    });
  });
});