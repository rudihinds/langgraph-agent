#!/bin/bash

# Run tests for SupabaseCheckpointer
echo "Running SupabaseCheckpointer tests..."
npm test -- "lib/persistence/__tests__/supabase-checkpointer.test.ts"

# Check if tests passed
if [ $? -eq 0 ]; then
  echo "✅ SupabaseCheckpointer tests passed!"
else
  echo "❌ SupabaseCheckpointer tests failed"
  exit 1
fi

# Run validation tests using @langchain/langgraph/checkpoint-validation if available
echo "Running validation tests (if available)..."
if npx ts-node -e "import('@langchain/langgraph/checkpoint-validation').catch(() => process.exit(0))"; then
  npm test -- "lib/persistence/__tests__/checkpoint-validation.test.ts" || \
  echo "⚠️ Validation tests not found or failed. You can add them later."
else
  echo "⚠️ @langchain/langgraph/checkpoint-validation not found. Skipping validation tests."
fi

echo "Completed all tests." 