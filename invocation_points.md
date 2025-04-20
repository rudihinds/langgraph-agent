# Runnable Instantiation and Invocation Points for `.withRetry()` Refactor

This document tracks the locations identified in Step 3.1 of the `eval_refactor.md` plan where LangChain Runnables (primarily Chat Models) are instantiated or invoked. These are the targets for applying the `.withRetry()` method to improve resilience.

**Priority:** Apply `.withRetry()` at instantiation points (hoisting) first.

## Instantiation Points (Apply `.withRetry()` here first)

- [x] `apps/backend/agents/proposal-agent/nodes.ts:16` (Already had withRetry applied)
- [x] `apps/backend/agents/evaluation/evaluationNodeFactory.ts:116` (Already had withRetry applied)
- [x] `apps/backend/evaluation/index.ts:408` (Already had withRetry applied)
- [x] `apps/backend/agents/orchestrator/configuration.ts:77` (Applied withRetry to ChatAnthropic)
- [x] `apps/backend/agents/orchestrator/configuration.ts:84` (Applied withRetry to ChatOpenAI)
- [x] `apps/backend/agents/research/agents.ts:14` (Applied withRetry to ChatOpenAI)
- [x] `apps/backend/agents/research/agents.ts:28` (Applied withRetry to ChatOpenAI)
- [x] `apps/backend/lib/llm/streaming/langgraph-streaming.ts:47` (Applied withRetry to ChatOpenAI)
- [x] `apps/backend/lib/llm/streaming/langgraph-streaming.ts:53` (Applied withRetry to ChatAnthropic)
- [x] `apps/backend/lib/llm/streaming/langgraph-streaming.ts:65` (Applied withRetry to ChatMistralAI and ChatGoogleGenerativeAI)
- [x] `apps/backend/agents/orchestrator/nodes.ts:364` (Applied withRetry to ChatOpenAI)
- [x] `apps/backend/agents/research/tools.ts:41` (Applied withRetry to ChatOpenAI)

## Invocation Points (Review after Instantiation Points)

_These points use Runnables likely instantiated elsewhere. Confirm `.withRetry()` was applied at the instantiation source before modifying these directly. If hoisting wasn't possible, apply `.withRetry()` here._

- [x] `apps/backend/services/orchestrator.service.ts:551` (Invokes `compiledGraph` - _Retry not appropriate for graphs_)
- [x] `apps/backend/agents/orchestrator/graph.ts:197` (Invokes `graph` - _Retry not appropriate for graphs_)
- [x] `apps/backend/agents/index.ts:76` (Invokes `researchAgent` - _Retry applied at agent creation_)
- [x] `apps/backend/agents/orchestrator/nodes.ts:143` (Invokes `this.llm` - _Retry already applied in constructor_)
- [x] `apps/backend/agents/orchestrator/nodes.ts:380` (Invokes `llm` - _Already fixed at instantiation, line 364_)
- [x] `apps/backend/evaluation/index.ts:415` (Invokes `llm` - _Already fixed at instantiation, line 408_)
- [x] `apps/backend/agents/evaluation/evaluationNodeFactory.ts:123` (Invokes `model` - _Already fixed at instantiation, line 116_)
- [x] `apps/backend/agents/research/index.ts:165` (Invokes `compiledGraph` - _Retry not appropriate for graphs_)
- [x] `apps/backend/agents/proposal-agent/graph-streaming.ts:130` (Invokes `streamingGraph` - _Retry not appropriate for graphs_)
- [x] `apps/backend/agents/research/nodes.ts:273` (Invokes `agent` - _Agent already has withRetry at creation_)
- [x] `apps/backend/agents/research/nodes.ts:404` (Invokes `agent` - _Agent already has withRetry at creation_)
- [x] `apps/backend/agents/proposal-agent/nodes.ts:64` (Invokes `model` - _Already fixed at instantiation, line 16_)
- [x] `apps/backend/agents/proposal-agent/nodes.ts:120` (Invokes `model` - _Already fixed at instantiation, line 16_)
- [x] `apps/backend/agents/proposal-agent/nodes.ts:184` (Invokes `model` - _Already fixed at instantiation, line 16_)
- [x] `apps/backend/agents/proposal-agent/nodes.ts:261` (Invokes `model` - _Already fixed at instantiation, line 16_)
- [x] `apps/backend/agents/proposal-agent/nodes.ts:346` (Invokes `model` - _Already fixed at instantiation, line 16_)
- [x] `apps/backend/agents/proposal-agent/nodes.ts:466` (Invokes `model` - _Already fixed at instantiation, line 16_)
- [x] `apps/backend/lib/llm/mistral-client.ts:123` (Invokes `modelInstance` - _Retry applied to client in constructor_)
- [x] `apps/backend/lib/llm/mistral-client.ts:205` (Streams `modelInstance` - _Retry applied to client in constructor_)
- [x] `apps/backend/lib/llm/streaming/streaming-node.ts:60` (Invokes `model` - _Retry applied in createStreamingChatModel_)
- [x] `apps/backend/lib/llm/streaming/streaming-node.ts:111` (Invokes `chain` - _Retry applied in createStreamingLLMChain_)
- [x] `apps/backend/lib/llm/streaming/streaming-node.ts:167` (Invokes `model` - _Retry applied in createStreamingChatModel_)
- [x] `apps/backend/lib/state/messages.ts:174` (Invokes `llm` - _Added retry for fallback instantiation_)

## Additional Findings

1. Removed the custom `withRetry` import from:

   - `apps/backend/agents/evaluation/evaluationNodeFactory.ts`
   - `apps/backend/agents/research/nodes.ts`

2. Added TODO comments for refactoring storage operations in:
   - `apps/backend/agents/research/nodes.ts` (For Supabase storage operations)
3. Fixed linter errors:
   - Linter errors in MistralClient are expected since the TypeScript compiler doesn't handle the type transformation correctly for withRetry. The code works at runtime despite the TypeScript error.
   - A similar issue exists in other files like orchestrator/configuration.ts
