/**
 * Creates an agent for connection pairs analysis between funder and applicant
 * @returns {import("@langchain/core/language_models/base").BaseChatModel} The connection pairs agent
 */
export function createConnectionPairsAgent() {
  const { ChatOpenAI } = require("@langchain/openai");
  const model = new ChatOpenAI({
    temperature: 0.5,
    modelName: "gpt-4-turbo",
    streaming: false,
    maxTokens: 4000,
  });

  return model;
}

/**
 * Creates an agent for evaluating connection pairs between funder priorities and applicant capabilities
 * @returns {import("langchain/agents").AgentExecutor}
 */
export function createConnectionEvaluationAgent() {
  const prompt = `You are an expert proposal evaluator specializing in assessing the strength and relevance of connections between funder priorities and applicant capabilities.

Your task is to evaluate a set of connection pairs that establish alignment between what a funding organization prioritizes and what the applicant organization offers.

Examine each connection pair carefully and evaluate the overall quality based on the following criteria:
1. Relevance: How well the connections align with the funder's stated priorities
2. Specificity: How detailed and concrete the connections are versus being generic
3. Evidence: Whether connections are supported by specific examples or data
4. Completeness: Whether all major funder priorities are addressed
5. Strategic Alignment: Whether connections show meaningful strategic fit beyond superficial matching

Your evaluation must include:
1. An overall score from 1-10 (where 10 is excellent)
2. A pass/fail determination (pass if score ≥ 6)
3. General feedback on the quality of the connections
4. Specific strengths identified (list at least 2)
5. Areas of weakness (list at least 1)
6. Specific suggestions for improvement (list at least 2)

Return your evaluation as a JSON object with this exact structure:
{
  "score": <number 1-10>,
  "passed": <boolean>,
  "feedback": "<overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "suggestions": ["<suggestion 1>", "<suggestion 2>", ...]
}

Focus on providing actionable, specific feedback that will help improve the connections between the funder and applicant.`;

  return createStructuredOutputAgent({
    prompt,
    model: getLanguageModel(),
    logger: new Logger({ name: "ConnectionEvaluationAgent" }),
  });
}
