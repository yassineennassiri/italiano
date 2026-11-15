import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The scoring core is pure (issue #5): no UI framework, no database.
    files: ["src/scoring/**/*.ts"],
    ignores: ["src/scoring/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*"],
              message: "src/scoring must stay free of React and Next.js.",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/*", "@neondatabase/*", "@/db", "@/db/*"],
              message: "src/scoring must stay free of database code.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
