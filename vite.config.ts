import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative paths, so the built game works from a subfolder like /Realm_Forge/.
  base: "./",
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
