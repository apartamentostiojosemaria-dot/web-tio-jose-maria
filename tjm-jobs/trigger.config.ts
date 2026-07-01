import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
    // Proyecto dedicado tjm-jobs en cloud.trigger.dev (org: padron-ia).
    // Override puntual vía env var TRIGGER_PROJECT_REF si hiciera falta.
    project: process.env.TRIGGER_PROJECT_REF || "proj_azldqeufdufzorjzhnkk",
    runtime: "node",
    logLevel: "log",
    retries: {
        enabledInDev: true,
        default: {
            maxAttempts: 3,
            minTimeoutInMs: 1000,
            maxTimeoutInMs: 10000,
            factor: 2,
            randomize: true,
        },
    },
    dirs: ["./src/trigger"],
});
