# Refactor Intelligence Gathering to LangGraph Native Pattern

Let's refactor our intelligence gathering flow to a more simple, LangGraph native pattern. The goal is to simplify the **researchAgent** intelligence gathering flow so it looks at the current state and determines itself whether to make tool calls or if it has enough information to complete its goal. This is an arbitrary example which will need adjusting to our spec.

## Refactoring Requirements

### 1. State Schema Updates
Extend the current state schema to include fields for tracking search progress. this may be done for the intel gathring process already for the data we need to gather:

```javascript
import { Annotation } from "@langchain/langgraph";
import { MessagesAnnotation } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Track what we've searched
  searchQueries: Annotation<string[]>({
    reducer: (existing, new) => [...existing, ...new],
    default: () => []
  }),
  // Store raw results (not in messages!)
  searchResults: Annotation<any[]>({
    reducer: (existing, new) => [...existing, ...new],
    default: () => []
  }),
  // Research tracking
  topicsNeeded: Annotation<string[]>({
    default: () => []
  }),
  topicsCovered: Annotation<string[]>({
    reducer: (existing, new) => [...existing, ...new],
    default: () => []
  })
});
```

### 2. Tool Definition with Command Pattern
Refactor the Tavily web search tool to use the Command pattern:

```javascript
import { tool } from "@langchain/core/tools";
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";

const webSearchTool = tool(async ({ query }, config) => {
  // Execute search
  const searchResponse = await tavilyClient.search(query, {
    max_results: 5,
    search_depth: "advanced"
  });
  
  // Determine which topic this covers (optional LLM processing)
  const topicAnalysis = await llm.invoke([
    { 
      role: "system", 
      content: `Given these topics: ${config.state.topicsNeeded.join(', ')}
                Which topic does this search relate to?` 
    },
    { role: "user", content: `Query: ${query}\nResults: ${searchResponse.answer}` }
  ]);
  
  // Return Command to update multiple state fields
  return new Command({
    update: {
      searchQueries: [query],
      searchResults: [{
        query,
        results: searchResponse.results,
        answer: searchResponse.answer,
        timestamp: new Date()
      }],
      topicsCovered: [topicAnalysis.content],
      messages: [
        new ToolMessage({
          content: `Searched: "${query}" - Found ${searchResponse.results.length} results`,
          tool_call_id: config.toolCall.id,
        })
      ]
    }
  });
}, {
  name: "web_search",
  description: "Search for information on the web"
});
```

### 3. Agent Prompt Updates
Create a `stateModifier` function that dynamically constructs the agent's context:

```javascript
const stateModifier = (state) => {
  const uncoveredTopics = state.topicsNeeded.filter(
    topic => !state.topicsCovered.includes(topic)
  );
  
  const systemPrompt = `You are a research agent tasked with gathering information.

GOAL: Research all required topics: ${state.topicsNeeded.join(', ')}

PROGRESS:
- Topics covered: ${state.topicsCovered.join(', ') || 'None yet'}
- Topics remaining: ${uncoveredTopics.join(', ') || 'All complete'}
- Searches completed: ${state.searchQueries.length}
- Total results gathered: ${state.searchResults.reduce((sum, r) => sum + r.results.length, 0)}

INSTRUCTIONS:
- If topics remain uncovered, create search queries for up to 3 topics at once
- If all topics are covered, provide a summary without tool calls
- Avoid duplicate searches - you've already searched: ${state.searchQueries.join(', ')}`;

  return [
    { role: "system", content: systemPrompt },
    ...state.messages
  ];
};
```

### 4. Agent Decision Logic
The agent should examine state and decide whether to make tool calls:

```javascript
const researchAgent = async (state) => {
  const modifiedMessages = stateModifier(state);
  const response = await llm.bindTools([webSearchTool]).invoke(modifiedMessages);
  
  // Agent will either:
  // 1. Return tool_calls for more searches
  // 2. Return final summary (no tool_calls)
  return { messages: [response] };
};
```

Example of agent creating multiple concurrent searches:
```javascript
// Inside the agent's response generation
const uncoveredTopics = state.topicsNeeded.filter(t => !state.topicsCovered.includes(t));
const searchBatch = uncoveredTopics.slice(0, 3); // Up to 3 concurrent searches

const toolCalls = searchBatch.map((topic, idx) => ({
  id: `call_${Date.now()}_${idx}`,
  name: "web_search",
  args: { query: `${topic} ${state.baseQuery || ''}` },
  type: "tool_call"
}));

// Return AIMessage with multiple tool_calls for concurrent execution
```

### 5. Graph Structure
Create a simple conditional routing structure:

```javascript
import { StateGraph, END, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Simple routing logic
const shouldContinue = (state) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls?.length > 0) {
    return "tools";
  }
  return "summarize";
};

// Tool node
const toolNode = new ToolNode([webSearchTool]);

// Build graph
const workflow = new StateGraph(StateAnnotation)
  .addNode("research", researchAgent)
  .addNode("tools", toolNode)
  .addNode("summarize", summaryNode)
  .addEdge(START, "research")
  .addConditionalEdges("research", shouldContinue, {
    tools: "tools",
    summarize: "summarize"
  })
  .addEdge("tools", "research")  // Loop back
  .addEdge("summarize", END);

const graph = workflow.compile();
```

### 6. Performance Considerations
Since Tavily doesn't support batch requests, implement concurrent execution through multiple tool calls:

```javascript
// Agent returns multiple tool_calls
{
  tool_calls: [
    { id: "1", name: "web_search", args: { query: "topic1 details" }},
    { id: "2", name: "web_search", args: { query: "topic2 information" }},
    { id: "3", name: "web_search", args: { query: "topic3 research" }}
  ]
}

// ToolNode executes these concurrently (check LangGraph docs for parallel execution config)
```

## Implementation Steps

1. First, look up the exact import syntax for Command in LangGraphJS
2. Check if Tavily has any batch API endpoints or concurrent request capabilities
3. Update the state schema with the new tracking fields
4. Rewrite the web search tool to use Command pattern
5. Implement the stateModifier for dynamic prompt construction
6. Simplify the agent node to just examine state and decide on tool usage
7. Create the minimal shouldContinue router
8. Wire up the graph with the new simplified flow

## Key Principles
- State stores data, messages store communication
- Agent makes decisions based on state inspection
- Tools update state directly via Command pattern
- Keep token usage low by summarizing in state, not messages
- Leverage concurrent tool execution for better performance

Remember: The agent should now be much simpler - it just looks at what topics it needs to research, what it's already found, and decides whether to search more or conclude.