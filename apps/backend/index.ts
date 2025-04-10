import { createServer } from "http";
import { createCustomAgent } from "./agents/basic-agent";
import { runMultiAgentExample } from "./agents/multi-agent";
import { runProposalAgent } from "./agents/proposal-agent/graph";
import { runProposalAgent as runRefactoredProposalAgent } from "./agents/proposal-agent/graph-refactored.js";
import "dotenv/config";

// Start a basic HTTP server
const server = createServer(async (req, res) => {
  // Set CORS headers to allow requests from the frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS requests for CORS
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Basic router for different agent endpoints
  if (req.url === "/api/basic-agent" && req.method === "POST") {
    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        const { query } = JSON.parse(body);
        const agent = createCustomAgent();
        const result = await agent.invoke({
          messages: [{ type: "human", content: query }],
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error" }));
    }
  } else if (req.url === "/api/multi-agent" && req.method === "POST") {
    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        const { topic } = JSON.parse(body);
        const result = await runMultiAgentExample(topic);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error" }));
    }
  } else if (req.url === "/api/proposal-agent" && req.method === "POST") {
    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        const { query } = JSON.parse(body);
        const result = await runProposalAgent(query);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      });
    } catch (error) {
      console.error("Error in proposal agent:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error" }));
    }
  } else if (
    req.url === "/api/proposal-agent-refactored" &&
    req.method === "POST"
  ) {
    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        const { query } = JSON.parse(body);
        const result = await runRefactoredProposalAgent(query);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      });
    } catch (error) {
      console.error("Error in refactored proposal agent:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error" }));
    }
  } else if (req.url === "/api/health" && req.method === "GET") {
    // Health check endpoint
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Available endpoints:");
  console.log("- GET /api/health - Health check");
  console.log("- POST /api/basic-agent - Basic agent");
  console.log("- POST /api/multi-agent - Multi-agent system");
  console.log("- POST /api/proposal-agent - Proposal agent");
  console.log(
    "- POST /api/proposal-agent-refactored - Refactored proposal agent"
  );
  console.log(
    "\nNote: You can also use the LangGraph server with 'npm run dev:agents'"
  );
});
