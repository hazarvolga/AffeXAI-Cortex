import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const eslintConfig = [
    ...compat.extends("next/core-web-vitals"),
    {
        // Custom overrides if needed, placed here to avoid circular merge issues
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            // "no-console": "warn",
        }
    }
];

export default eslintConfig;
