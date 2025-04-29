import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import { fixupConfigRules } from "@eslint/compat";

export default [
  {files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"]},
  { languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...fixupConfigRules(pluginReactConfig),
  {
    rules: {
      // These rules help catch platform-specific issues
      "react-native/no-inline-styles": "warn",
      "react-native/no-color-literals": "warn", 
      "react-native/no-raw-text": "warn",
      "react-native/no-single-element-style-arrays": "error",
      // This is particularly helpful for catching platform inconsistencies
      "react-native/platform-specific-extensions": "error"
    }
  },
];