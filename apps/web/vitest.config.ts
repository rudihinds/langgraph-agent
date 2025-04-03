import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", ".git/**"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["**/node_modules/**", "**/__tests__/**"],
    },
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
