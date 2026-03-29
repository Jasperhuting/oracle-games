import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "functions/lib/**",
      "firebase-export-*/**",
      "next-env.d.ts",
      "tests/**",
      "scripts/**"
    ],
  },
];

export default eslintConfig;
