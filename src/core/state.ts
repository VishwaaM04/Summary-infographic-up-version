
import { NotebookLMClient } from "../notebooklm_client.js";
import { logToFile } from "./logger.js";

// SINGLETON CLIENT
let notebookClient: NotebookLMClient | null = null;

export async function getClient(): Promise<NotebookLMClient> {
    if (!notebookClient) {
        logToFile("Initializing Singleton NotebookLMClient...");
        const headless = process.env.HEADLESS !== "false" && process.env.NOTEBOOKLM_HEADLESS !== "false";
        notebookClient = new NotebookLMClient(headless);
        try {
            await notebookClient.start();
            logToFile("NotebookLMClient started successfully.");
        } catch (e) {
            logToFile(`Failed to start client: ${e}`);
            // Ensure we close the browser so we don't lock the data directory
            try { await notebookClient.stop(); } catch (err) { }
            notebookClient = null; // Reset on failure
            throw e;
        }
    }
    return notebookClient;
}

export async function shutdownClient() {
    if (notebookClient) {
        await notebookClient.stop();
        notebookClient = null;
    }
}
