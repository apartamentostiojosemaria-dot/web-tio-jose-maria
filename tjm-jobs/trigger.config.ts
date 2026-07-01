import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
    // Reemplaza TRIGGER_PROJECT_REF al crear el proyecto en cloud.trigger.dev
    // (org: padron-ia). El ref tiene forma proj_xxx_xxx.
    project: process.env.TRIGGER_PROJECT_REF || "proj_REPLACE_ME",
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
