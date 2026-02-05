
// --- STDIO HYGIENE ---
// Redirect console.log to stderr to prevent breaking MCP JSON-RPC framing
console.log = console.error;

import sharp from "sharp";
import { setupLogging, logToFile } from "./core/logger.js";
import { shutdownClient } from "./core/state.js";
import { startStdioServer } from "./transports/stdio.js";
import { startHttpServer } from "./transports/http.js";

// Initialize Logging
setupLogging();
logToFile("SERVER STARTING...");

// Graceful Shutdown Hooks
async function shutdown() {
    logToFile("Shutting down server...");
    await shutdownClient();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Do NOT exit on unhandled async errors
process.on('uncaughtException', (err) => {
    logToFile(`UNCAUGHT EXCEPTION: ${err.stack || err}`);
});
process.on('unhandledRejection', (reason) => {
    logToFile(`UNHANDLED REJECTION: ${reason}`);
});

async function main() {
    try {
        logToFile("Initializing Transports...");

        // SAFE SHARP CONFIG
        sharp.cache(false);
        sharp.concurrency(1);

        // AUTO-KILL PORT 3000 CONFLICTS
        const { freePort } = await import("./core/port_manager.js");
        await freePort(3000);

        // Initialize Client (Force browser check on startup)
        const { getClient } = await import("./core/state.js");
        await getClient();

        // Start Both Transports
        await startStdioServer();
        await startHttpServer();

    } catch (e) {
        logToFile(`FATAL STARTUP ERROR: ${e}`);
        process.exit(1);
    }
}

main();
