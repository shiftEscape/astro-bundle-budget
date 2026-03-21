# 📦 astro-bundle-budget-workspace

Monorepo for [`astro-bundle-budget`](https://www.npmjs.com/package/@shiftescape/astro-bundle-budget) — a build-time JS/CSS bundle size budget integration for Astro.

## 📁 Structure

```
astro-bundle-budget/
├── packages/
│   └── astro-bundle-budget/   # the published npm package
└── demo/                      # local Astro site for testing the integration
```

## 🚀 Getting started

Install all workspace dependencies from the root:

```bash
npm install
```

## ⚙️ Development workflow

**1️⃣ Build the package** (required before testing in the demo):

```bash
npm run build:pkg
```

Or keep it watching for changes in a separate terminal:

```bash
cd packages/astro-bundle-budget && npm run dev
```

**2️⃣ Run the demo build** to see the integration in action:

```bash
npm run build:demo
```

**3️⃣ Run both in one shot:**

```bash
npm run test:demo
```

## 🧪 Running tests

```bash
npm test --workspace=packages/astro-bundle-budget
```

## 📦 Package

See [`packages/astro-bundle-budget/README.md`](./packages/astro-bundle-budget/README.md) for full usage docs, options, and examples.

## 📄 License

MIT © [Alvin James Bellero](https://github.com/shiftEscape)
