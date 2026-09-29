import { defineConfig } from "vitest/config";

// A bancada de equilíbrio (M8) fica fora do `npm run test`: são simulações longas que imprimem
// tabelas, não afirmações. Rode com `npm run balance`.
export default defineConfig({
  test: {
    include: ["tests/balance/**/*.bal.ts"],
    environment: "node",
    testTimeout: 600_000,
    reporters: ["verbose"],
  },
});
