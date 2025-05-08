import {
  StateGraph,
  START,
  END,
  MemorySaver,
  Annotation,
} from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== CHECKPOINTER FUNCTIONALITY TEST ===\n");

  console.log("1. Testing In-Memory Checkpointer:");

  // Create a simple memory checkpointer
  const memorySaver = new MemorySaver();

  // Create state annotation (required in newer versions)
  const CounterState = Annotation.Root({
    counter: Annotation.Number,
  });

  // Function to increment counter
  function incrementCounter(state) {
    return { counter: (state.counter || 0) + 1 };
  }

  // Create a simple graph with a counter node
  const simpleGraph = new StateGraph(CounterState)
    .addNode("increment", incrementCounter)
    .addEdge(START, "increment")
    .addEdge("increment", END);

  const memGraph = simpleGraph.compile({ checkpointer: memorySaver });

  try {
    // Test 1: Initialize with counter = 5
    const threadConfig1 = { configurable: { thread_id: "memory-test-1" } };
    const result1 = await memGraph.invoke({ counter: 5 }, threadConfig1);
    console.log("  Initial invoke with counter=5:", result1);

    // Test 2: Run again with null input (should use previous state)
    const result2 = await memGraph.invoke(null, threadConfig1);
    console.log("  Second invoke with null input:", result2);

    // Test 3: Try with a new thread_id (should start fresh)
    const threadConfig3 = { configurable: { thread_id: "memory-test-3" } };
    const result3 = await memGraph.invoke({ counter: 3 }, threadConfig3);
    console.log("  New thread_id with input counter=3:", result3);

    // Test 4: Retrieve state using getState
    const state1 = await memGraph.getState(threadConfig1);
    console.log(
      "  Retrieved state for thread_id memory-test-1:",
      state1 && state1.values ? state1.values : "No state found"
    );
  } catch (error) {
    console.log("  Memory checkpointer tests failed:", error.message);
    console.error(error);
  }

  console.log("\n2. Testing PostgreSQL Checkpointer (with fallback):");

  // Try to create a PostgreSQL saver with fallback
  let pgSaver;
  let usingFallback = false;

  try {
    // Test different connection string formats
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@db.rqwgqyhonjnzvgwxbrvh.supabase.co:5432/postgres";

    console.log(
      "  Attempting PostgreSQL connection with:",
      connectionString.replace(/:[^:]*@/, ":***@")
    );

    pgSaver = new PostgresSaver({
      connectionString,
      tableName: "checkpoints",
    });

    console.log("  PostgreSQL connection created - testing connection");

    // In newer versions, just instantiating doesn't test the connection
    // We need to do a simple operation
    try {
      // Test the connection by attempting to list tables or a similar operation
      const pgGraph = simpleGraph.compile({ checkpointer: pgSaver });
      const pgTestConfig = {
        configurable: { thread_id: "pg-connection-test" },
      };
      await pgGraph.invoke({ counter: 1 }, pgTestConfig);
      console.log("  PostgreSQL connection successful!");
    } catch (error) {
      throw new Error(`PostgreSQL operation test failed: ${error.message}`);
    }
  } catch (error) {
    console.log("  PostgreSQL connection failed:", error.message);
    console.log("  Falling back to in-memory checkpointer");
    pgSaver = new MemorySaver();
    usingFallback = true;
  }

  try {
    // Create the same graph but with PostgreSQL checkpointer (or fallback)
    const pgGraph = simpleGraph.compile({ checkpointer: pgSaver });

    // Test 1: Initialize with counter = 10
    const pgThreadConfig = { configurable: { thread_id: "pg-test-1" } };
    const pgResult1 = await pgGraph.invoke({ counter: 10 }, pgThreadConfig);
    console.log("  Initial invoke with counter=10:", pgResult1);

    // Test 2: Run again with null input (should use previous state)
    const pgResult2 = await pgGraph.invoke(null, pgThreadConfig);
    console.log("  Second invoke with null input:", pgResult2);

    // Test 3: Retrieve state using getState
    const pgState = await pgGraph.getState(pgThreadConfig);
    console.log(
      "  Retrieved state for thread_id pg-test-1:",
      pgState && pgState.values ? pgState.values : "No state found"
    );
  } catch (error) {
    console.log("  PostgreSQL checkpointer tests failed:", error.message);
    console.error(error);
  }

  // Check what kind of saver was actually used
  console.log("\n3. Checkpointer Type Detection:");
  console.log("  Memory saver type:", memorySaver.constructor.name);
  console.log(
    "  PG saver type:",
    pgSaver ? pgSaver.constructor.name : "Failed to initialize"
  );
  console.log("  Using fallback:", usingFallback);

  // Add a restart test
  console.log("\n4. State Persistence Test:");
  console.log(
    "  Memory checkpointer: State persists in-memory until process restarts"
  );
  console.log(
    "  PG checkpointer: State should persist after restarts if connection successful"
  );
  console.log(
    "  To fully verify persistence, please run this script again and check if thread_id 'pg-test-1' retained state"
  );

  console.log("\n=== TEST COMPLETE ===");
}

main().catch((error) => {
  console.error("Test failed:", error);
});
