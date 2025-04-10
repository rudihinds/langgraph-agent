/**
 * Configuration settings for the proposal agent
 */
export const configuration = {
  // Model configuration
  modelName: process.env.MODEL_NAME || "gpt-4o",
  temperature: parseFloat(process.env.TEMPERATURE || "0.5"),
  
  // Runtime configuration
  maxIterations: parseInt(process.env.MAX_ITERATIONS || "25", 10),
  
  // Streaming configuration
  streamToUser: process.env.STREAM_TO_USER === "true",
};