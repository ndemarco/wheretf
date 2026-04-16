import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // React 19 shipped a new rule that flags every `setState` inside a
    // `useEffect`. Many of our effects are intentional sync points
    // (hydrate from localStorage, reset per-prop state). Treat as a
    // warning project-wide rather than an error until we migrate the
    // specific cases to `useSyncExternalStore` / key-prop resets.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Tests use `module` as a domain variable (WhereTF Storage Module).
    // Next's `no-assign-module-variable` rule protects the reserved
    // Node/Webpack identifier in app/page files — not relevant in
    // tests or non-routed repositories.
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
]);

export default eslintConfig;
