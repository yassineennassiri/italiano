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
  {
    // All UI text lives in src/ui-it.ts (SPEC §6.3, ADR-0003), never inline in components.
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true }],
      "no-restricted-syntax": [
        "error",
        ...["Literal", "TemplateLiteral", "JSXExpressionContainer > Literal", "JSXExpressionContainer > TemplateLiteral"].map(
          (value) => ({
            selector: `JSXAttribute[name.name=/^(aria-label|aria-description|aria-roledescription|title|alt|placeholder)$/] > ${value}`,
            message: "UI text comes from src/ui-it.ts, not a literal.",
          }),
        ),
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
