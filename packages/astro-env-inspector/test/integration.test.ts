import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import envInspector from "../src/index.js";

// ---------------------------------------------------------------------------
// Integration factory
// ---------------------------------------------------------------------------

describe("envInspector integration", () => {
  it("returns an integration object with correct name", () => {
    const integration = envInspector();
    assert.equal(integration.name, "astro-env-inspector");
  });

  it("has astro:config:setup, astro:config:done and astro:server:setup hooks", () => {
    const integration = envInspector();
    assert.ok(typeof integration.hooks["astro:config:setup"] === "function");
    assert.ok(typeof integration.hooks["astro:config:done"] === "function");
    assert.ok(typeof integration.hooks["astro:server:setup"] === "function");
  });

  it("accepts options without throwing", () => {
    assert.doesNotThrow(() =>
      envInspector({
        sensitivePatterns: ["MY_SECRET"],
        showAstroBuiltins: false,
        revealByDefault: false,
      }),
    );
  });

  it("does not register toolbar app in build mode", () => {
    const integration = envInspector();
    let addDevToolbarAppCalled = false;
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    integration.hooks["astro:config:setup"]?.({
      command: "build",
      addDevToolbarApp: () => {
        addDevToolbarAppCalled = true;
      },
      logger: mockLogger,
      config: { root: new URL("file:///tmp/"), vite: {} },
    } as any);

    assert.equal(addDevToolbarAppCalled, false);
  });

  it("registers toolbar app in dev mode", () => {
    const integration = envInspector();
    let registeredApp: any = null;
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    integration.hooks["astro:config:setup"]?.({
      command: "dev",
      addDevToolbarApp: (app: any) => {
        registeredApp = app;
      },
      logger: mockLogger,
      config: { root: new URL("file:///tmp/"), vite: {} },
    } as any);

    assert.ok(registeredApp !== null);
    assert.equal(registeredApp.id, "astro-env-inspector");
    assert.equal(registeredApp.name, "ENV Inspector");
    assert.ok(registeredApp.entrypoint.endsWith("toolbar-app.js"));
  });

  it("does not register toolbar app in preview mode", () => {
    const integration = envInspector();
    let addDevToolbarAppCalled = false;
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    integration.hooks["astro:config:setup"]?.({
      command: "preview",
      addDevToolbarApp: () => {
        addDevToolbarAppCalled = true;
      },
      logger: mockLogger,
      config: { root: new URL("file:///tmp/"), vite: {} },
    } as any);

    assert.equal(addDevToolbarAppCalled, false);
  });

  it("server:setup hook registers request handler", () => {
    const integration = envInspector();
    const registeredHandlers: string[] = [];

    const mockToolbar = {
      on: (event: string, _cb: (...args: any[]) => void) => {
        registeredHandlers.push(event);
      },
      send: () => {},
    };

    integration.hooks["astro:server:setup"]?.({ toolbar: mockToolbar } as any);
    assert.ok(registeredHandlers.includes("astro-env-inspector:request"));
  });

  it("server responds with env payload including .env file vars", () => {
    // Create a temp dir with a .env file
    const tmpDir = join(tmpdir(), `astro-env-int-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, ".env"), "PUBLIC_TEST_VAR=hello_from_dotenv\n");

    const integration = envInspector();

    // Simulate astro:config:setup in dev mode to set projectRoot
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
    integration.hooks["astro:config:setup"]?.({
      command: "dev",
      addDevToolbarApp: () => {},
      logger: mockLogger,
      config: { root: new URL(`file://${tmpDir}/`), vite: {} },
    } as any);

    const captured: Array<{ event: string; payload: any }> = [];
    const handlers = new Map<string, (...args: any[]) => void>();

    const mockToolbar = {
      on: (event: string, cb: (...args: any[]) => void) => {
        handlers.set(event, cb);
      },
      send: (event: string, payload: any) => {
        captured.push({ event, payload });
      },
    };

    integration.hooks["astro:server:setup"]?.({ toolbar: mockToolbar } as any);

    const handler = handlers.get("astro-env-inspector:request");
    assert.ok(handler, "request handler should be registered");
    handler({});

    assert.equal(captured.length, 1);
    assert.equal(captured[0].event, "astro-env-inspector:data");

    const payload = captured[0].payload;
    assert.ok(Array.isArray(payload.vars));
    assert.ok(typeof payload.totalCount === "number");

    const testVar = payload.vars.find((v: any) => v.key === "PUBLIC_TEST_VAR");
    assert.ok(
      testVar,
      "PUBLIC_TEST_VAR from .env file should appear in payload",
    );
    assert.equal(testVar.value, "hello_from_dotenv");
    assert.equal(testVar.group, "public");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("revealByDefault flag is passed in payload", () => {
    const integration = envInspector({ revealByDefault: true });
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
    integration.hooks["astro:config:setup"]?.({
      command: "dev",
      addDevToolbarApp: () => {},
      logger: mockLogger,
      config: { root: new URL("file:///tmp/"), vite: {} },
    } as any);

    const captured: Array<{ event: string; payload: any }> = [];
    const handlers = new Map<string, (...args: any[]) => void>();
    const mockToolbar = {
      on: (event: string, cb: (...args: any[]) => void) => {
        handlers.set(event, cb);
      },
      send: (event: string, payload: any) => {
        captured.push({ event, payload });
      },
    };

    integration.hooks["astro:server:setup"]?.({ toolbar: mockToolbar } as any);
    handlers.get("astro-env-inspector:request")?.({});

    assert.equal(captured[0].payload.revealByDefault, true);
  });
});
