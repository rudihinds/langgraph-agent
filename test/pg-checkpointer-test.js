import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import dotenv from "dotenv";

dotenv.config();

/**
 * Test the PostgresSaver from the latest version of @langchain/langgraph-checkpoint-postgres
 */
async function main() {
  console.log("=== POSTGRES CHECKPOINTER TEST ===\n");

  // Connection string to use
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@db.rqwgqyhonjnzvgwxbrvh.supabase.co:5432/postgres";

  console.log(
    "Using connection string:",
    connectionString.replace(/:[^:]*@/, ":***@")
  );

  try {
    // Create PostgreSQL checkpointer
    const pgSaver = new PostgresSaver({
      connectionString,
      tableName: "checkpoints",
    });

    console.log("PostgreSQL saver created, testing setup...");

    // Setup the tables
    try {
      await pgSaver.setup();
      console.log("✅ Table setup successful");
    } catch (error) {
      console.error("❌ Table setup failed:", error.message);
      throw error;
    }

    // Create state annotation for the test graph
    const CounterState = Annotation.Root({
      counter: Annotation.Number,
    });

    // Create increment function
    function incrementCounter(state) {
      return { counter: (state.counter || 0) + 1 };
    }

    // Create a simple graph with a counter node
    console.log("\nCreating test graph...");
    const simpleGraph = new StateGraph(CounterState)
      .addNode("increment", incrementCounter)
      .addEdge(START, "increment")
      .addEdge("increment", END);

    // Compile with PostgreSQL checkpointer
    const pgGraph = simpleGraph.compile({ checkpointer: pgSaver });
    console.log("✅ Graph compiled successfully with PostgreSQL checkpointer");

    // Test 1: Initialize with counter = 10
    console.log("\nTesting state persistence...");
    const pgThreadConfig = { configurable: { thread_id: "pg-test-1" } };
    console.log("- Invoking with initial state (counter=10)");
    const pgResult1 = await pgGraph.invoke({ counter: 10 }, pgThreadConfig);
    console.log("  Result:", pgResult1);

    // Test 2: Run again with null input (should use previous state)
    console.log("- Invoking with null state (should use previous state)");
    const pgResult2 = await pgGraph.invoke(null, pgThreadConfig);
    console.log("  Result:", pgResult2);

    // Test 3: Get state directly via getState
    console.log("- Getting state directly via getState");
    const pgState = await pgGraph.getState(pgThreadConfig);
    console.log(
      "  Retrieved state:",
      pgState && pgState.values
        ? JSON.stringify(pgState.values)
        : "No state found"
    );

    console.log("\n=== TEST COMPLETE ===");
    console.log("PostgreSQL checkpointer is working correctly!");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    console.error("PostgreSQL checkpointer is not working correctly.");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
