import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "bidwriter-v1/**",
      ".git/**",
    ],
    setupFiles: ["./vitest.setup.ts"],
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
