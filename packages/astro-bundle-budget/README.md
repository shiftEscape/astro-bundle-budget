# @shiftescape/astro-bundle-budget

[![version](https://img.shields.io/npm/v/@shiftescape/astro-bundle-budget.svg?style=flat-square)](http://npm.im/@shiftescape/astro-bundle-budget) [![downloads](https://img.shields.io/npm/dm/@shiftescape/astro-bundle-budget.svg?style=flat-square)](https://npm-stat.com/charts.html?package=@shiftescape/astro-bundle-budget&from=2016-11-24) [![MIT License](https://img.shields.io/npm/l/@shiftescape/astro-bundle-budget.svg?style=flat-square)](http://opensource.org/licenses/MIT)

Build-time JS/CSS bundle size budgets for Astro. Inspect every asset and page payload at the end of `astro build` — and optionally fail CI when you exceed your thresholds. 📊

```
▶ astro-bundle-budget  Analysing bundle…

  Asset                                                Type       Size
  ────────────────────────────────────────────────────────────────────
  assets/index-BxK92mPq.js                              js    42.3 kB
  assets/vendor-CHmL3xRz.js                             js    18.7 kB
  assets/hoisted-DqW1Pz9a.js                            js     3.1 kB
  assets/index-EpW3Kz7b.css                            css     6.4 kB
  ────────────────────────────────────────────────────────────────────
  Total JS                                              js    64.1 kB
  Total CSS                                            css     6.4 kB

  Budget violations

  ✗ assets/vendor-CHmL3xRz.js: 18.7 kB exceeds budget of 15 kB (+25% over)

  1 budget violation exceeded.
```

## 📦 Install

```bash
npm install -D astro-bundle-budget
# or
pnpm add -D astro-bundle-budget
```

## 🛠️ Usage

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import bundleBudget from "astro-bundle-budget";

export default defineConfig({
  integrations: [
    bundleBudget({
      // Per-file limits — first matching glob wins
      budgets: [
        { path: "assets/vendor-*.js", budget: "50 kB" },
        { path: "**/*.js", budget: "100 kB" },
        { path: "**/*.css", budget: "20 kB" },
      ],

      // Per-page limits — total payload a single page may reference
      pageBudgets: [
        { type: "js", budget: "150 kB" },
        { type: "css", budget: "30 kB" },
        { type: "total", budget: "200 kB", compression: "gzip" },
      ],
    }),
  ],
});
```

### ⚡ Zero-config (size display only)

Add the integration with no options to get a free asset table after every build:

```js
integrations: [bundleBudget()];
```

## ⚙️ Options

| Option         | Type           | Default                       | Description                                   |
| -------------- | -------------- | ----------------------------- | --------------------------------------------- |
| `budgets`      | `BudgetRule[]` | `[]`                          | Per-file glob rules                           |
| `pageBudgets`  | `PageBudget[]` | `[]`                          | Per-page total payload rules                  |
| `failOnExceed` | `boolean`      | `true`                        | Exit 1 when a budget is exceeded              |
| `report`       | `boolean`      | `false`                       | Write `bundle-budget-report.json` to `outDir` |
| `reportPath`   | `string`       | `'bundle-budget-report.json'` | Report filename                               |
| `verbose`      | `boolean`      | `false`                       | Show all assets + per-page breakdown          |

### 📋 `BudgetRule`

```ts
interface BudgetRule {
  path: string; // minimatch glob against asset path
  budget: number | string; // bytes or '100 kB', '1.5 MB'
  compression?: "none" | "gzip" | "brotli"; // default: 'none'
}
```

### 📄 `PageBudget`

```ts
interface PageBudget {
  type: "js" | "css" | "total"; // what to measure per page
  budget: number | string;
  compression?: "none" | "gzip" | "brotli";
}
```

### 📐 Size strings

Accepted formats: `'100 kB'`, `'1.5 MB'`, `'50 KB'`, `'200kb'`, `'1.2 MiB'`, or a plain number (bytes).

### 🗜️ Compression

Set `compression: 'gzip'` or `compression: 'brotli'` to measure the wire size your users actually receive. Useful for `pageBudgets` targeting real-world performance.

## 🔄 CI integration

Because `failOnExceed: true` by default, `astro build` exits with code 1 when any budget is exceeded — no extra setup needed for GitHub Actions, GitLab CI, or any other CI platform.

To turn violations into warnings (still shows the table, never fails):

```js
bundleBudget({ failOnExceed: false });
```

## 📋 JSON report

Enable `report: true` to write a machine-readable report to `dist/bundle-budget-report.json`:

```json
{
  "generatedAt": "2025-03-21T10:00:00.000Z",
  "totalAssets": 4,
  "totalJsBytes": 65536,
  "totalCssBytes": 6553,
  "assets": [...],
  "pages": [...],
  "violations": [...],
  "passed": false
}
```

Store this file as a CI artefact and diff it between builds to track bundle growth over time.

## ⚖️ vs. alternatives

|                     | astro-bundle-budget | vite-plugin-bundlesize | rollup-plugin-visualizer |
| ------------------- | ------------------- | ---------------------- | ------------------------ |
| Astro-native config | ✅                  | ❌ (Vite config)       | ❌                       |
| Per-page breakdown  | ✅                  | ❌                     | ❌                       |
| Fails the build     | ✅                  | ✅                     | ❌                       |
| Compression budgets | ✅                  | ✅                     | ❌                       |
| Static HTML report  | JSON                | `bundlemeta.json`      | `stats.html`             |
| Zero extra deps     | ✅                  | ❌                     | ❌                       |

## 📄 License

[MIT](https://github.com/shiftEscape/astro-integrations/blob/main/packages/astro-bundle-budget/LICENSE)

## 🙏 Acknowledgements

Built with the [Astro Integration API](https://docs.astro.build/en/reference/integrations-reference/) and listed in the [Astro Integrations Library](https://astro.build/integrations/). 🌟
