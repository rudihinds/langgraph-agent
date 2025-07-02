# LangGraphJS ToolNode Pattern: Complete Rules Guide

*Based on official LangGraphJS documentation - ironclad rules for building solid ToolNode patterns*

## 🔧 Tool Definition Rules

### Rule 1: Use Official Tool Function
```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
```

### Rule 2: Every Tool MUST Have Required Properties
```typescript
const myTool = tool((input) => {
  // Tool logic here
  return "result";
}, {
  name: 'tool_name',           // REQUIRED: string identifier
  description: 'Description',  // REQUIRED: string explanation
  schema: z.object({          // REQUIRED: Zod schema
    param: z.string().describe("Parameter description")
  })
});
```

### Rule 3: Tools Array Before ToolNode
```typescript
const tools = [tool1, tool2, tool3]; // Array required
const toolNode = new ToolNode(tools);
```

---

## 📨 State Requirements

### Rule 4: State MUST Have Messages Key with Reducer
**ToolNode works with any StateGraph as long as its state has a `messages` key with appropriate reducer**

```typescript
// ✅ OPTION 1: Use MessagesAnnotation
import { MessagesAnnotation } from "@langchain/langgraph";

// ✅ OPTION 2: Custom state with messages key
const CustomState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: (x, y) => x.concat(y) }),
  otherField: Annotation<string>()
});
```

### Rule 5: Messages Reducer MUST Concatenate
```typescript
// REQUIRED pattern:
{ reducer: (x, y) => x.concat(y) }
```

---

## 🤖 Chat Model Requirements

### Rule 6: Model MUST Support Tool Calling
- Use OpenAI, Anthropic, or other tool-capable models
- Avoid models without tool calling support

### Rule 7: MUST Bind Tools to Model
```typescript
const modelWithTools = new ChatAnthropic({
  model: "claude-3-haiku-20240307",
  temperature: 0
}).bindTools(tools); // REQUIRED: bind before using
```

---

## 💬 Message Format Rules

### Rule 8: ToolNode Expects Specific AIMessage Format
```typescript
const aiMessage = new AIMessage({
  content: "",                    // Can be empty or have content
  tool_calls: [                  // REQUIRED for ToolNode
    {
      name: "tool_name",          // MUST match tool name exactly
      args: { param: "value" },   // MUST match tool schema
      id: "unique_id",            // REQUIRED: unique identifier
      type: "tool_call"           // REQUIRED: literal "tool_call"
    }
  ]
});
```

### Rule 9: Last Message MUST Have tool_calls
- ToolNode reads `messages[messages.length - 1]`
- That message MUST have `tool_calls` array
- If no `tool_calls`, ToolNode will fail

---

## 🔄 Graph Structure Rules

### Rule 10: Conditional Edge MUST Check Tool Calls Correctly
```typescript
const shouldContinue = (state: typeof MessagesAnnotation.State) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  
  // CRITICAL: Check existence, type, AND length
  if ("tool_calls" in lastMessage && 
      Array.isArray(lastMessage.tool_calls) && 
      lastMessage.tool_calls?.length) {
    return "tools";
  }
  return END;
}
```

### Rule 11: Graph Node Structure Pattern
```typescript
const workflow = new StateGraph(MessagesAnnotation) // Or custom state
  .addNode("agent", callModel)     // Model node
  .addNode("tools", toolNode)      // ToolNode
  .addEdge(START, "agent")         // Start with agent
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");      // Tools back to agent
```

---

## 🔧 ToolNode Invocation Rules

### Rule 12: ToolNode Input Format
```typescript
await toolNode.invoke({ 
  messages: [aiMessageWithToolCalls] 
});
```

### Rule 13: ToolNode Output Format (Automatic)
```typescript
// ToolNode automatically returns:
{
  messages: [
    ToolMessage {
      content: "tool result",
      name: "tool_name", 
      tool_call_id: "matching_id"
    }
  ]
}
```

---

## 🎯 Model Node Rules

### Rule 14: Model Node MUST Return Single Message
```typescript
const callModel = async (state: typeof MessagesAnnotation.State) => {
  const { messages } = state;
  const response = await modelWithTools.invoke(messages);
  return { messages: response }; // Single message, NOT array
}
```

### Rule 15: Message Wrapping Rules
```typescript
// ✅ CORRECT - Model node returns single message
return { messages: response };

// ❌ WRONG - Never wrap in array  
return { messages: [response] };
```

---

## ⚠️ Critical Error Prevention

### Rule 16: Import Paths
```typescript
import { StateGraph, MessagesAnnotation, END, START } from "@langchain/langgraph";
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
```

### Rule 17: Tool Call IDs MUST Be Unique
- Each tool call needs unique `id`
- Don't reuse IDs within same message

### Rule 18: Tool Names MUST Match Exactly
- `tool_calls[].name` must match `tool.name` exactly
- Case sensitive

### Rule 19: Args MUST Match Schema
- Tool call args must validate against tool's Zod schema
- Missing required fields will cause errors

---

## 🔄 Parallel Tool Calling Rules

### Rule 20: Multiple Tool Calls Format
```typescript
const multiToolMessage = new AIMessage({
  content: "",
  tool_calls: [
    { name: "tool1", args: {}, id: "id1", type: "tool_call" },
    { name: "tool2", args: {}, id: "id2", type: "tool_call" }
  ]
});
```

### Rule 21: Parallel Execution Results
- Each tool call gets separate ToolMessage in response
- ToolNode handles parallel execution automatically

---

## 📋 Debugging Checklist

When ToolNode breaks, verify:

- [ ] Does state have `messages` key with `(x, y) => x.concat(y)` reducer?
- [ ] Are tools bound to model with `.bindTools(tools)`?
- [ ] Does last message have `tool_calls` array with length > 0?
- [ ] Is model node returning single message (not array)?
- [ ] Do tool names in `tool_calls` match tool definitions exactly?
- [ ] Are tool call IDs unique within each message?
- [ ] Do tool call args validate against tool schemas?
- [ ] Is conditional edge checking all three: existence, type, and length of `tool_calls`?
- [ ] Are imports from correct paths?

---

## 🚨 Non-Negotiable Requirements

**Breaking ANY of these rules will cause the ToolNode pattern to fail:**

1. **State MUST have `messages` key with concat reducer**
2. **Tools MUST be bound to model with `.bindTools()`**
3. **Last message MUST have `tool_calls` array for ToolNode to work**
4. **Model node MUST return single message, not array**
5. **Tool names MUST match exactly between definition and calls**
6. **Conditional edge MUST check `tool_calls` existence, type, and length**

These rules are based on the official LangGraphJS documentation and are mandatory for successful ToolNode implementation.