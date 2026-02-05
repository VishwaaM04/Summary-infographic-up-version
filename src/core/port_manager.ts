import { exec } from "child_process";
import { promisify } from "util";
import { logToFile } from "./logger.js";

const execAsync = promisify(exec);

export async function freePort(port: number): Promise<void> {
    if (process.platform !== 'win32') {
        logToFile("⚠️ Auto-kill port only supported on Windows for now.");
        return;
    }

    logToFile(`[PortManager] Checking if port ${port} is in use...`);

    try {
        // 1. Find PID
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        if (!stdout || !stdout.includes("LISTENING")) {
            logToFile(`[PortManager] Port ${port} seems free.`);
            return;
        }

        const lines = stdout.split('\n');
        const listeningLine = lines.find(line => line.includes("LISTENING"));

        if (listeningLine) {
            const parts = listeningLine.trim().split(/\s+/);
            const pid = parts[parts.length - 1]; // PID is last column

            if (pid && pid !== "0") {
                logToFile(`[PortManager] Found process ${pid} using port ${port}. Killing...`);
                await execAsync(`taskkill /F /PID ${pid}`);
                logToFile(`[PortManager] Process ${pid} killed. Port ${port} freed.`);
                // Wait a split second for OS to release handle
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    } catch (e: any) {
        if (e.message && e.message.includes("void")) {
            // findstr might return exit code 1 if empty, which exec throws as error
            logToFile(`[PortManager] Port ${port} is free.`);
        } else {
            logToFile(`[PortManager] Error checking/freeing port: ${e.message}`);
        }
    }
}
