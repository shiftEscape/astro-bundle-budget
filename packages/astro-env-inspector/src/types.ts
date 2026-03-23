// ---------------------------------------------------------------------------
// Public option types
// ---------------------------------------------------------------------------

export interface EnvInspectorOptions {
  /**
   * Additional variable names to always treat as secrets and mask.
   * Supports exact match and glob-style prefix (e.g. 'MY_APP_*').
   * Default built-in patterns: KEY, SECRET, TOKEN, PASSWORD, PASS, PWD,
   * PRIVATE, AUTH, CREDENTIAL, CERT, API_KEY
   */
  sensitivePatterns?: string[];

  /**
   * Show Astro built-in variables (MODE, DEV, PROD, SITE, BASE_URL, etc.)
   * @default true
   */
  showAstroBuiltins?: boolean;

  /**
   * If true, values start revealed instead of masked.
   * Not recommended for shared screens.
   * @default false
   */
  revealByDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Internal types shared between server ↔ client
// ---------------------------------------------------------------------------

export type EnvGroup = "public" | "private" | "astro" | "other";

export interface EnvVar {
  key: string;
  value: string | undefined;
  group: EnvGroup;
  isSet: boolean;
  isSensitive: boolean;
  /** PUBLIC_ var that looks like it contains a secret — warn the user */
  isLeaking: boolean;
}

export interface EnvPayload {
  vars: EnvVar[];
  totalCount: number;
  publicCount: number;
  privateCount: number;
  missingCount: number;
  leakingCount: number;
}
