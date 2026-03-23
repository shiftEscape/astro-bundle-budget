import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type {
  EnvGroup,
  EnvVar,
  EnvInspectorOptions,
  EnvPayload,
} from "./types.js";

// ---------------------------------------------------------------------------
// Astro built-in variable names
// ---------------------------------------------------------------------------

export const ASTRO_BUILTINS = new Set([
  "MODE",
  "DEV",
  "PROD",
  "SITE",
  "BASE_URL",
  "ASSETS_PREFIX",
]);

// ---------------------------------------------------------------------------
// Default sensitive keyword patterns (matched against key)
// ---------------------------------------------------------------------------

const DEFAULT_SENSITIVE = [
  "KEY",
  "SECRET",
  "TOKEN",
  "PASSWORD",
  "PASS",
  "PWD",
  "PRIVATE",
  "AUTH",
  "CREDENTIAL",
  "CERT",
  "API_KEY",
  "APIKEY",
  "ACCESS_KEY",
  "CLIENT_SECRET",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesSensitive(key: string, patterns: string[]): boolean {
  const upper = key.toUpperCase();
  return patterns.some((pattern) => {
    const p = pattern.toUpperCase();
    if (p.endsWith("*")) return upper.includes(p.slice(0, -1));
    return upper.includes(p);
  });
}

export function classifyGroup(key: string): EnvGroup {
  if (ASTRO_BUILTINS.has(key)) return "astro";
  if (key.startsWith("PUBLIC_")) return "public";
  return "private";
}

export function isSensitiveKey(key: string, extra: string[] = []): boolean {
  return matchesSensitive(key, [...DEFAULT_SENSITIVE, ...extra]);
}

/**
 * A PUBLIC_ variable is "leaking" if its name suggests it contains a secret.
 */
export function isLeakingSecret(key: string, extra: string[] = []): boolean {
  if (!key.startsWith("PUBLIC_")) return false;
  return isSensitiveKey(key, extra);
}

// ---------------------------------------------------------------------------
// Parse .env files directly from the project root
// Reads: .env, .env.local, .env.development, .env.development.local
// ---------------------------------------------------------------------------

export function loadDotEnvFiles(
  root: string,
  mode: string,
): Record<string, string> {
  const files = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];

  const result: Record<string, string> = {};

  for (const file of files) {
    const filePath = join(root, file);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) result[key] = value;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main collection function — runs on the server side
// ---------------------------------------------------------------------------

export function collectEnvVars(
  options: EnvInspectorOptions = {},
  context: { root?: string; mode?: string; astroBuiltins?: EnvVar[] } = {},
): EnvPayload {
  const { sensitivePatterns = [], showAstroBuiltins = true } = options;

  // Merge process.env with values parsed directly from .env files
  // .env file values take priority since they are project-specific
  const astroBuiltinVars = context.astroBuiltins ?? [];

  const dotEnvVars = context.root
    ? loadDotEnvFiles(context.root, context.mode ?? "development")
    : {};

  const raw: Record<string, string | undefined> = {
    ...process.env,
    ...dotEnvVars,
  };

  const vars: EnvVar[] = [];

  // Track keys already covered by injected Astro builtins
  const astroBuiltinKeys = new Set(astroBuiltinVars.map((v) => v.key));

  for (const [key, value] of Object.entries(raw)) {
    if (shouldSkip(key)) continue;
    // Skip — will be replaced by the accurate config-derived value below
    if (astroBuiltinKeys.has(key)) continue;

    const group = classifyGroup(key);
    // Skip astro group from process.env since we inject them accurately below
    if (group === "astro") continue;

    const sensitive = isSensitiveKey(key, sensitivePatterns);
    const leaking = isLeakingSecret(key, sensitivePatterns);

    vars.push({
      key,
      value: value ?? undefined,
      group,
      isSet: value !== undefined && value !== "",
      isSensitive: sensitive,
      isLeaking: leaking,
    });
  }

  // Inject Astro built-ins resolved directly from config
  if (showAstroBuiltins) {
    vars.push(...astroBuiltinVars);
  }

  // Sort: public → private → astro → other, then alphabetically within group
  const ORDER: EnvGroup[] = ["public", "private", "astro", "other"];
  vars.sort((a, b) => {
    const gi = ORDER.indexOf(a.group) - ORDER.indexOf(b.group);
    if (gi !== 0) return gi;
    return a.key.localeCompare(b.key);
  });

  const publicCount = vars.filter((v) => v.group === "public").length;
  const privateCount = vars.filter((v) => v.group === "private").length;
  const missingCount = vars.filter((v) => !v.isSet).length;
  const leakingCount = vars.filter((v) => v.isLeaking).length;

  return {
    vars,
    totalCount: vars.length,
    publicCount,
    privateCount,
    missingCount,
    leakingCount,
  };
}

// ---------------------------------------------------------------------------
// Keys to always skip — noisy OS / Node internals
// ---------------------------------------------------------------------------

const SKIP_PREFIXES = [
  "npm_",
  "NVM_",
  "HOMEBREW_",
  "ITERM",
  "TERM",
  "COLORTERM",
  "SHLVL",
  "OLDPWD",
  "TMPDIR",
  "XPC_",
  "LESS",
  "PAGER",
  "__CF",
  "MallocNanoZone",
  "APPLE_",
  "COMMAND_MODE",
];

const SKIP_EXACT = new Set([
  "_",
  "PWD",
  "OLDPWD",
  "SHLVL",
  "TERM_PROGRAM",
  "TERM_PROGRAM_VERSION",
  "TERM_SESSION_ID",
  "SHELL",
  "LOGNAME",
  "USER",
  "HOME",
  "PATH",
  "MANPATH",
  "INFOPATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
]);

function shouldSkip(key: string): boolean {
  if (SKIP_EXACT.has(key)) return true;
  return SKIP_PREFIXES.some((p) => key.startsWith(p));
}
