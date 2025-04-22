import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { createProposalGenerationGraph } from "./agents/proposal-generation/graph.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "..", "..", "langgraph.json");

// Read the configuration file
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Create express app
const app = express();
const port = process.env.PORT || 2024;

// Add middleware
app.use(express.json());

// Create the proposal generation graph
const graph = createProposalGenerationGraph();

// Set up routes
app.post("/run", async (req, res) => {
  try {
    const { input } = req.body;
    const result = await graph.invoke(input);
    res.json({ output: result });
  } catch (error) {
    console.error("Error running graph:", error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the application
app.listen(port, () => {
  console.log(`LangGraph server running at http://localhost:${port}`);
  console.log(`Configuration loaded from: ${configPath}`);
  console.log(`Graph endpoints: http://localhost:${port}/run`);
});
