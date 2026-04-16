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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    testTimeout: 10000,
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: "backend",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: [
            "tests/components/**",
            "tests/pages/**",
            "tests/frontend/**",
            "tests/lib/**",
          ],
          setupFiles: ["./tests/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "frontend",
          environment: "jsdom",
          include: [
            "tests/components/**/*.test.{ts,tsx}",
            "tests/pages/**/*.test.{ts,tsx}",
            "tests/frontend/**/*.test.{ts,tsx}",
            "tests/lib/**/*.test.{ts,tsx}",
          ],
          setupFiles: ["./tests/setup.frontend.ts"],
        },
      },
    ],
  },
});
