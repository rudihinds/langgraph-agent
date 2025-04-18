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
