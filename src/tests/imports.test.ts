import { describe, it, expect } from "vitest";
import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";

describe("imports", () => {
  it("should import all required dependencies", () => {
    expect(StateGraph).toBeDefined();
    expect(ChatOpenAI).toBeDefined();
    expect(createClient).toBeDefined();
  });
});
