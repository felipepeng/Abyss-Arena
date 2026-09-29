import { defineConfig } from "vitest/config";

export default defineConfig({
  // Caminhos relativos no build: o jogo funciona em qualquer subpasta de um servidor estático
  // (GitHub Pages, itch.io, uma pasta qualquer), não só na raiz do domínio.
  base: "./",
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
