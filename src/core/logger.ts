
import * as fs from 'fs';
import * as path from 'path';



// --- DEBUG LOGGING ---
const LOG_FILE = "C:/Users/vishw/OneDrive/Desktop/Altrosyn_Projects/Summary-Infographic-Final-stHTTP/server_live.log";

// Open file once for performance (sync) but safety (immediate flush)
let logFd: number | null = null;
try {
    logFd = fs.openSync(LOG_FILE, 'a');
} catch (e) {
    console.error("Failed to open log file:", e);
}

export function logToFile(msg: string) {
    if (logFd === null) return;
    const timestamp = new Date().toLocaleString();
    const entry = `[${timestamp}] ${msg}\n`;
    try {
        fs.writeSync(logFd, entry);
    } catch (e) {
        // ignore
    }
}

// Redirect console.error to file + original stderr
export function setupLogging() {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
        // Format args like console does
        const msg = args.map(a =>
            (typeof a === 'object') ? JSON.stringify(a) : String(a)
        ).join(" ");

        logToFile(msg);
        originalConsoleError(...args);
    };


    // Redirect console.log to console.error (std hygiene) + file
    console.log = console.error;
}
