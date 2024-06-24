import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["h5ai-nginx", "**/node_modules/", "**/build/", "**/dist/"],
    rules: {
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn"],
      indent: [
        "error",
        2,
        { SwitchCase: 1, ignoredNodes: ["ConditionalExpression"] },
      ],
      "@typescript-eslint/ban-ts-comment": "off",
    },
  }
);
