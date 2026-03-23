# @shiftescape/astro-env-inspector

[![version](https://img.shields.io/npm/v/@shiftescape/astro-env-inspector.svg?style=flat-square)](http://npm.im/@shiftescape/astro-env-inspector) [![downloads](https://img.shields.io/npm/dm/@shiftescape/astro-env-inspector.svg?style=flat-square)](https://npm-stat.com/charts.html?package=@shiftescape/astro-env-inspector&from=2016-11-24) [![MIT License](https://img.shields.io/npm/l/@shiftescape/astro-env-inspector.svg?style=flat-square)](http://opensource.org/licenses/MIT)

A dev toolbar integration for Astro that shows all your environment variables — grouped, masked, and searchable — directly inside `astro dev`. Zero footprint in production.

```
ENV Inspector (1 leaking) (1 missing) (8 vars)
─────────────────────────────────────────────────────
PUBLIC: 3   PRIVATE: 8   ASTRO: 4
─────────────────────────────────────────────────────
🌐 Public (PUBLIC_*)
  🟢 PUBLIC_SITE_NAME        My Astro Site
  🟢 PUBLIC_API_URL          https://api.example.com
  🟠 PUBLIC_API_KEY          ••••••••            👁 📋

🔒 Private / Server-only
  🟢 DATABASE_URL            postgres://localhost/db
  🟢 STRIPE_SECRET_KEY       ••••••••            👁 📋
  🔴 SENDGRID_API_KEY        not set

🚀 Astro Built-ins
  🟢 MODE                    development
  🟢 DEV                     true
─────────────────────────────────────────────────────
```

## Features

- 🔒 **Dev-only** — completely stripped in `astro build` and `astro preview`, zero production footprint
- 📋 **Grouped** — variables organised into Public, Private, Astro built-ins
- ✅ **Set vs missing** — instantly spot variables that are unset
- 👁 **Masked by default** — sensitive values hidden with a per-variable reveal toggle
- ⚠️ **Leak detection** — warns when a `PUBLIC_*` variable looks like it contains a secret
- 🔍 **Searchable** — filter by key or value in real time
- 📋 **Copy on click** — copy any value to clipboard instantly

## Install

```bash
npm install -D @shiftescape/astro-env-inspector
# or
pnpm add -D @shiftescape/astro-env-inspector
```

## Usage

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import envInspector from "@shiftescape/astro-env-inspector";

export default defineConfig({
  integrations: [envInspector()],
});
```

Open your site in `astro dev`, click the toolbar icon in the bottom bar, and the panel appears.

### With options

```js
envInspector({
  // Extra key patterns to always treat as sensitive and mask
  sensitivePatterns: ["MY_APP_SECRET", "INTERNAL_*"],

  // Hide Astro built-ins (MODE, DEV, PROD, SITE, BASE_URL)
  showAstroBuiltins: false,

  // Start with all values revealed (not recommended for shared screens)
  revealByDefault: false,
});
```

## Options

| Option              | Type       | Default | Description                                               |
| ------------------- | ---------- | ------- | --------------------------------------------------------- |
| `sensitivePatterns` | `string[]` | `[]`    | Extra key patterns to mask. Supports `*` suffix wildcard. |
| `showAstroBuiltins` | `boolean`  | `true`  | Show `MODE`, `DEV`, `PROD`, `SITE`, `BASE_URL` etc.       |
| `revealByDefault`   | `boolean`  | `false` | Start with all values unmasked.                           |

### Built-in sensitive patterns

The following patterns are always masked regardless of options:
`KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PASS`, `PWD`, `PRIVATE`, `AUTH`, `CREDENTIAL`, `CERT`, `API_KEY`, `APIKEY`, `ACCESS_KEY`, `CLIENT_SECRET`

### Leak detection

If a `PUBLIC_*` variable matches any sensitive pattern, the inspector flags it with a ⚠ warning — both in the panel and in the terminal. For example, `PUBLIC_API_KEY` would trigger this warning since it's publicly exposed to the browser but looks like a secret.

## Dev-only guarantee

The integration checks `command === 'dev'` in `astro:config:setup` and returns early for `build` and `preview`. The toolbar app entrypoint is never registered, never bundled, and never shipped to users.

## License

MIT © [Alvin James Bellero](https://github.com/shiftEscape)
