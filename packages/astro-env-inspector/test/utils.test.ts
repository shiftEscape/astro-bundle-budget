import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  classifyGroup,
  isSensitiveKey,
  isLeakingSecret,
  collectEnvVars,
  loadDotEnvFiles,
  ASTRO_BUILTINS,
} from "../src/utils.js";

// ---------------------------------------------------------------------------
// classifyGroup
// ---------------------------------------------------------------------------

describe("classifyGroup", () => {
  it("classifies PUBLIC_ vars as public", () => {
    assert.equal(classifyGroup("PUBLIC_API_URL"), "public");
    assert.equal(classifyGroup("PUBLIC_SITE_NAME"), "public");
  });

  it("classifies Astro built-ins correctly", () => {
    for (const key of ASTRO_BUILTINS) {
      assert.equal(classifyGroup(key), "astro");
    }
  });

  it("classifies everything else as private", () => {
    assert.equal(classifyGroup("DATABASE_URL"), "private");
    assert.equal(classifyGroup("STRIPE_SECRET_KEY"), "private");
    assert.equal(classifyGroup("MY_APP_CONFIG"), "private");
  });
});

// ---------------------------------------------------------------------------
// isSensitiveKey
// ---------------------------------------------------------------------------

describe("isSensitiveKey", () => {
  it("flags keys containing default sensitive patterns", () => {
    assert.ok(isSensitiveKey("STRIPE_SECRET_KEY"));
    assert.ok(isSensitiveKey("DATABASE_PASSWORD"));
    assert.ok(isSensitiveKey("AUTH_TOKEN"));
    assert.ok(isSensitiveKey("AWS_ACCESS_KEY"));
    assert.ok(isSensitiveKey("PRIVATE_KEY"));
    assert.ok(isSensitiveKey("API_KEY"));
  });

  it("does not flag plain non-sensitive keys", () => {
    assert.ok(!isSensitiveKey("DATABASE_URL"));
    assert.ok(!isSensitiveKey("SITE_NAME"));
    assert.ok(!isSensitiveKey("PUBLIC_API_URL"));
    assert.ok(!isSensitiveKey("PORT"));
    assert.ok(!isSensitiveKey("NODE_ENV"));
  });

  it("respects extra sensitive patterns", () => {
    assert.ok(isSensitiveKey("MY_APP_MAGIC", ["MAGIC"]));
    assert.ok(isSensitiveKey("SPECIAL_VALUE", ["SPECIAL_*"]));
  });
});

// ---------------------------------------------------------------------------
// isLeakingSecret
// ---------------------------------------------------------------------------

describe("isLeakingSecret", () => {
  it("flags PUBLIC_ vars with sensitive-looking names", () => {
    assert.ok(isLeakingSecret("PUBLIC_API_KEY"));
    assert.ok(isLeakingSecret("PUBLIC_SECRET_TOKEN"));
    assert.ok(isLeakingSecret("PUBLIC_AUTH_PASSWORD"));
  });

  it("does not flag non-PUBLIC_ vars", () => {
    assert.ok(!isLeakingSecret("STRIPE_SECRET_KEY"));
    assert.ok(!isLeakingSecret("DATABASE_PASSWORD"));
  });

  it("does not flag safe PUBLIC_ vars", () => {
    assert.ok(!isLeakingSecret("PUBLIC_API_URL"));
    assert.ok(!isLeakingSecret("PUBLIC_SITE_NAME"));
    assert.ok(!isLeakingSecret("PUBLIC_ENABLE_FEATURE"));
  });

  it("respects extra patterns", () => {
    assert.ok(isLeakingSecret("PUBLIC_MY_MAGIC", ["MAGIC"]));
  });
});

// ---------------------------------------------------------------------------
// loadDotEnvFiles
// ---------------------------------------------------------------------------

describe("loadDotEnvFiles", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = join(tmpdir(), `astro-env-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads variables from .env file", () => {
    writeFileSync(
      join(tmpDir, ".env"),
      "PUBLIC_SITE=My Site\nDATABASE_URL=postgres://localhost\n",
    );
    const vars = loadDotEnvFiles(tmpDir, "development");
    assert.equal(vars["PUBLIC_SITE"], "My Site");
    assert.equal(vars["DATABASE_URL"], "postgres://localhost");
  });

  it("strips surrounding quotes from values", () => {
    writeFileSync(
      join(tmpDir, ".env"),
      "QUOTED=\"hello world\"\nSINGLE='foo bar'\n",
    );
    const vars = loadDotEnvFiles(tmpDir, "development");
    assert.equal(vars["QUOTED"], "hello world");
    assert.equal(vars["SINGLE"], "foo bar");
  });

  it("ignores comment lines and blank lines", () => {
    writeFileSync(join(tmpDir, ".env"), "# this is a comment\n\nVALID=yes\n");
    const vars = loadDotEnvFiles(tmpDir, "development");
    assert.equal(vars["VALID"], "yes");
    assert.equal(Object.keys(vars).filter((k) => k.startsWith("#")).length, 0);
  });

  it("loads mode-specific .env file", () => {
    writeFileSync(
      join(tmpDir, ".env.development"),
      "MODE_SPECIFIC=dev-value\n",
    );
    const vars = loadDotEnvFiles(tmpDir, "development");
    assert.equal(vars["MODE_SPECIFIC"], "dev-value");
  });

  it("returns empty object when no .env files exist", () => {
    const emptyDir = join(tmpDir, "empty");
    mkdirSync(emptyDir, { recursive: true });
    const vars = loadDotEnvFiles(emptyDir, "development");
    assert.deepEqual(vars, {});
  });
});

// ---------------------------------------------------------------------------
// collectEnvVars
// ---------------------------------------------------------------------------

describe("collectEnvVars", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = join(tmpdir(), `astro-env-collect-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      join(tmpDir, ".env"),
      [
        "PUBLIC_SITE_NAME=My Site",
        "PUBLIC_API_KEY=super-secret",
        "DATABASE_URL=postgres://localhost/mydb",
        "STRIPE_SECRET_KEY=sk_test_abc123",
      ].join("\n"),
    );
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns a payload with vars array", () => {
    const payload = collectEnvVars({}, { root: tmpDir });
    assert.ok(Array.isArray(payload.vars));
    assert.ok(payload.totalCount > 0);
  });

  it("includes PUBLIC_ vars from .env in the public group", () => {
    const payload = collectEnvVars({}, { root: tmpDir });
    const pub = payload.vars.find((v) => v.key === "PUBLIC_SITE_NAME");
    assert.ok(pub);
    assert.equal(pub.group, "public");
    assert.ok(pub.isSet);
    assert.equal(pub.isSensitive, false);
  });

  it("detects leaking PUBLIC_ vars from .env", () => {
    const payload = collectEnvVars({}, { root: tmpDir });
    const leaker = payload.vars.find((v) => v.key === "PUBLIC_API_KEY");
    assert.ok(leaker);
    assert.ok(leaker.isLeaking);
    assert.ok(payload.leakingCount >= 1);
  });

  it("includes private vars from .env", () => {
    const payload = collectEnvVars({}, { root: tmpDir });
    const db = payload.vars.find((v) => v.key === "DATABASE_URL");
    assert.ok(db);
    assert.equal(db.group, "private");
  });

  it("marks sensitive private vars correctly", () => {
    const payload = collectEnvVars({}, { root: tmpDir });
    const stripe = payload.vars.find((v) => v.key === "STRIPE_SECRET_KEY");
    assert.ok(stripe);
    assert.ok(stripe.isSensitive);
    assert.equal(stripe.isLeaking, false);
  });

  it("counts missing vars correctly", () => {
    writeFileSync(join(tmpDir, ".env"), "EMPTY_VAR=\n");
    const payload = collectEnvVars({}, { root: tmpDir });
    const empty = payload.vars.find((v) => v.key === "EMPTY_VAR");
    assert.ok(empty);
    assert.equal(empty.isSet, false);
    assert.ok(payload.missingCount >= 1);
  });

  it("respects showAstroBuiltins: false", () => {
    process.env["MODE"] = "development";
    const payload = collectEnvVars(
      { showAstroBuiltins: false },
      { root: tmpDir },
    );
    const mode = payload.vars.find((v) => v.key === "MODE");
    assert.equal(mode, undefined);
    delete process.env["MODE"];
  });

  it("sorts public vars before private vars", () => {
    const payload = collectEnvVars({}, { root: tmpDir });
    const groups = payload.vars.map((v) => v.group);
    const firstPrivate = groups.indexOf("private");
    const lastPublic = groups.lastIndexOf("public");
    if (firstPrivate !== -1 && lastPublic !== -1) {
      assert.ok(lastPublic < firstPrivate);
    }
  });

  it("respects custom sensitivePatterns", () => {
    writeFileSync(join(tmpDir, ".env"), "MY_MAGIC_VALUE=abcdef\n");
    const payload = collectEnvVars(
      { sensitivePatterns: ["MAGIC"] },
      { root: tmpDir },
    );
    const magic = payload.vars.find((v) => v.key === "MY_MAGIC_VALUE");
    assert.ok(magic);
    assert.ok(magic.isSensitive);
  });

  it("works with no root context (falls back to process.env)", () => {
    process.env["FALLBACK_TEST_VAR"] = "fallback";
    const payload = collectEnvVars();
    assert.ok(Array.isArray(payload.vars));
    delete process.env["FALLBACK_TEST_VAR"];
  });
});
