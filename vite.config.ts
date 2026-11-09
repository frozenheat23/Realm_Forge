import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative paths, so the built game works from a subfolder like /Realm_Forge/.
  base: "./",
  test: {
    include: ["tests/**/*.test.ts"],
    // Simulation tests share the machine when the whole suite runs at once; the default
    // 5 seconds tripped tests that take ~1.5 s on their own.
    testTimeout: 30_000,
  },
});
