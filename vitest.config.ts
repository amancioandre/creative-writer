import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // The real `obsidian` package is type-only; at test time we stand in a
      // minimal stub so infrastructure adapters can be exercised in jsdom.
      obsidian: path.resolve(__dirname, "tests/stubs/obsidian.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/application/ports/**", "src/domain/style/StyleRule.ts", "src/domain/style/Concreteness.ts", "src/domain/style/PosTagger.ts", "src/infrastructure/nlp/concreteness.data.ts"],
      reporter: ["text", "html"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
