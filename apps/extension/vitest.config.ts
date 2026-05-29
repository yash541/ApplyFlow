import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/content/runtime/**",
        "src/content/submission/**",
        "src/content/tracking/**",
        "src/content/shared/portal-runner.ts",
      ],
    },
  },
});
