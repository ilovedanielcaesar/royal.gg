import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Build output and dependencies are never linted.
  { ignores: ["dist", "node_modules", "*.tsbuildinfo"] },

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      // Vite's HMR only works if a module exports components and nothing else.
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Fires on every page that fetches in useEffect(() => { void load() }, []).
      // Downgraded to a warning rather than silenced: these are real, they are
      // all in the duplicated per-page fetching we're about to replace with a
      // single provider, and they should be back to zero once that lands.
      "react-hooks/set-state-in-effect": "warn",

      // The reason we installed this: catch dead code automatically instead of
      // grepping for it by hand. Args prefixed with _ are intentionally unused.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Config files run in Node, not the browser.
  {
    files: ["*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  }
);
