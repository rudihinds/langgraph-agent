import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@/lib": path.resolve(__dirname, "./lib"),
      "@/state": path.resolve(__dirname, "./state"),
      "@/agents": path.resolve(__dirname, "./agents"),
      "@/tools": path.resolve(__dirname, "./tools"),
      "@/services": path.resolve(__dirname, "./services"),
      "@/api": path.resolve(__dirname, "./api"),
      "@/prompts": path.resolve(__dirname, "./prompts"),
      "@/tests": path.resolve(__dirname, "./__tests__"),
      "@/config": path.resolve(__dirname, "./config"),
      "@/utils": path.resolve(__dirname, "./lib/utils"),
      "@/types": path.resolve(__dirname, "./types"),
      "@/proposal-generation": path.resolve(
        __dirname,
        "./agents/proposal-generation"
      ),
      "@/evaluation": path.resolve(__dirname, "./agents/evaluation"),
      "@/orchestrator": path.resolve(__dirname, "./agents/orchestrator"),
      "@": path.resolve(__dirname, "./"),
    },
  },
});
