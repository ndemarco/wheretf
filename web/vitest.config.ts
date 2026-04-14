import { defineConfig } from "vitest/config";
import path from "path";

// Force tests onto the wheretf_test database regardless of what the
// shell has set. tests/setup.ts TRUNCATEs every table after each
// spec, so if DATABASE_URL ever pointed at the dev DB the whole
// workshop would evaporate on every `npm test`. Belt + suspenders
// via a guard in tests/setup.ts.
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://wheretf:wheretf@localhost:5432/wheretf_test";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 10000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
