import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "node_modules/**/*",
      "build/**/*",
      "**/craco.config.js",
      "src/backend/pyodide/**/*",
      "src/backend/__test__/**/*",
    ],
  },
  ...compat.extends(
    "semistandard",
    "plugin:react/recommended",
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/recommended",
  ),
  {
    settings: {
      react: {
        createClass: "createReactClass",
        pragma: "React",
        fragment: "Fragment",
        version: "detect",
        flowVersion: "0.53",
      },

      propWrapperFunctions: [
        "forbidExtraProps",
        {
          property: "freeze",
          object: "Object",
        },
        {
          property: "myFavoriteWrapper",
        },
        {
          property: "forbidExtraProps",
          exact: true,
        },
      ],

      componentWrapperFunctions: [
        "observer",
        {
          property: "styled",
        },
        {
          property: "observer",
          object: "Mobx",
        },
        {
          property: "observer",
          object: "<pragma>",
        },
      ],

      formComponents: [
        "CustomForm",
        {
          name: "Form",
          formAttribute: "endpoint",
        },
      ],

      linkComponents: [
        "Hyperlink",
        {
          name: "Link",
          linkAttribute: "to",
        },
      ],
    },

    rules: {
      semi: ["error", "always"],
      camelcase: ["off"],
      "react/prop-types": ["off"],
      "@typescript-eslint/no-explicit-any": ["off"],
      "@typescript-eslint/no-empty-function": ["off"],
      "no-control-regex": ["off"],
    },
  },
];
