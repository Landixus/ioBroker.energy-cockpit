import ts from "typescript-eslint";
export default [
  {
    ignores: [
      "frontend/upstream/**",
      "test/upstream/**",
      "www/**",
      "build/**",
      ".private/**",
    ],
  },
  ...ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["test/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];
