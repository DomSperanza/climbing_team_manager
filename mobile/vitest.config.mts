import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests cover the pure logic in src/core (and the data it reads); UI is checked on devices.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["test/**/*.test.ts"], setupFiles: ["test/setup-timing.ts"] },
});
