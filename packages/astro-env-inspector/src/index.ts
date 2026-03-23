import type { AstroIntegration, AstroConfig } from "astro";
import { fileURLToPath } from "node:url";
import { collectEnvVars } from "./utils.js";
import type { EnvInspectorOptions, EnvPayload, EnvVar } from "./types.js";

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

export default function envInspector(
  options: EnvInspectorOptions = {},
): AstroIntegration {
  let projectRoot = process.cwd();
  let projectMode = "development";
  let astroBuiltins: EnvVar[] = [];

  return {
    name: "astro-env-inspector",

    hooks: {
      "astro:config:setup"({ addDevToolbarApp, command, logger, config }) {
        if (command !== "dev") return;

        projectRoot = fileURLToPath(config.root);

        logger.info("ENV Inspector active — visible in dev toolbar.");

        addDevToolbarApp({
          id: "astro-env-inspector",
          name: "ENV Inspector",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>`,
          entrypoint: fileURLToPath(
            new URL("./toolbar-app.js", import.meta.url),
          ),
        });
      },

      "astro:config:done"({ config }) {
        projectMode = config.vite?.mode ?? "development";

        // Build Astro built-ins directly from the resolved config
        // These are Vite-injected constants, never in process.env or .env files
        astroBuiltins = resolveAstroBuiltins(config, projectMode);
      },

      "astro:server:setup"({ toolbar }) {
        toolbar.on<Record<string, never>>(
          "astro-env-inspector:request",
          (_data) => {
            const payload: EnvPayload & { revealByDefault?: boolean } =
              collectEnvVars(options, {
                root: projectRoot,
                mode: projectMode,
                astroBuiltins,
              });

            if (options.revealByDefault) {
              (payload as any).revealByDefault = true;
            }

            if (payload.leakingCount > 0) {
              console.warn(
                `[astro-env-inspector] ${payload.leakingCount} PUBLIC_ variable${payload.leakingCount > 1 ? "s" : ""} may be leaking sensitive values.`,
              );
            }

            toolbar.send("astro-env-inspector:data", payload);
          },
        );
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Resolve Astro built-in variables from the resolved config object
// ---------------------------------------------------------------------------

function resolveAstroBuiltins(config: AstroConfig, mode: string): EnvVar[] {
  const builtins: Array<{ key: string; value: string }> = [
    { key: "MODE", value: mode },
    { key: "DEV", value: String(mode === "development") },
    { key: "PROD", value: String(mode === "production") },
    { key: "BASE_URL", value: config.base ?? "/" },
    { key: "SITE", value: config.site ?? "" },
  ];

  if (config.build?.assetsPrefix) {
    builtins.push({
      key: "ASSETS_PREFIX",
      value: String(config.build.assetsPrefix),
    });
  }

  return builtins.map(({ key, value }) => ({
    key,
    value,
    group: "astro" as const,
    isSet: value !== "" && value !== "undefined",
    isSensitive: false,
    isLeaking: false,
  }));
}

export type { EnvInspectorOptions };
