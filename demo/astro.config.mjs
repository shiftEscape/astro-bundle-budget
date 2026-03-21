import { defineConfig } from "astro/config";
import bundleBudget from "@shiftescape/astro-bundle-budget";

export default defineConfig({
  vite: {
    build: {
      assetsInlineLimit: 0, // force all assets to be emitted as files
    },
  },
  integrations: [
    bundleBudget({
      budgets: [{ path: "**/*.js", budget: "2 B" }],
      verbose: true,
    }),
  ],
});
