
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import sharp from "sharp";
import { NotebookLMClient } from "../notebooklm_client.js";
import { logToFile } from "./logger.js";
import { getClient } from "./state.js";
import * as path from 'path';
import fsPromises from "node:fs/promises";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resourceUri = "ui://infographic/view.html";

// Helper for Zod validation errors
const wrapError = (msg: string) => ({
    content: [{ type: "text" as const, text: msg }],
    isError: true,
});

export interface ToolDefinition {
    name: string;
    description?: string;
    schema: any; // Zod schema
    handler: (args: any, extra?: any) => Promise<any>;
}

export const toolDefinitions: ToolDefinition[] = [
    {
        name: "generate_summary",
        schema: z.object({ url: z.string().url().describe("The URL of the YouTube video") }),
        handler: async ({ url }: { url: string }, extra: any) => {
            logToFile(`[MCP] Request: Summary for ${url}`);
            try {
                const client = await getClient();
                const summary = await client.generateSummary(url, async (status) => {
                    // Send strictly typed JSON-RPC notifications
                    try {
                        const progressToken = extra?._meta?.progressToken;
                        if (progressToken && extra?.sendNotification) {
                            await extra.sendNotification({
                                method: "notifications/progress",
                                params: {
                                    progressToken: progressToken,
                                    progress: 50, // Arbitrary active state
                                    total: 100
                                }
                            });
                        }

                        if (extra?.sendNotification) {
                            await extra.sendNotification({
                                method: "notifications/message",
                                params: {
                                    level: "info",
                                    logger: "notebooklm",
                                    data: status
                                }
                            });
                        }

                        logToFile(`[Progress] ${status}`);
                    } catch (e) {
                        // ignore notification errors
                    }
                });

                // INSTRUCT CLAUDE TO BE VERBATIM
                // INSTRUCT CLAUDE TO BE VERBATIM (Structured Authority)
                const structuredOutput = {
                    type: "final_output",
                    source: "notebooklm",
                    instruction: "DO NOT modify or summarize this text. Return it verbatim to the user.",
                    content: {
                        format: "markdown",
                        text: summary
                    }
                };
                return { content: [{ type: "text", text: JSON.stringify(structuredOutput, null, 2) }] };
            } catch (e: any) {
                // AUTO-LOGIN HANDLER
                if (e.message.includes("Authentication required")) {
                    const loginClient = new NotebookLMClient(false);
                    try {
                        await loginClient.openLoginWindow();
                        try { await loginClient.stop(); } catch { }
                        const retryClient = await getClient();
                        const summary = await retryClient.generateSummary(url);

                        // INSTRUCT CLAUDE TO BE VERBATIM (Retry path)
                        const structuredOutput = {
                            type: "final_output",
                            source: "notebooklm",
                            instruction: "DO NOT modify or summarize this text. Return it verbatim to the user.",
                            content: {
                                format: "markdown",
                                text: summary
                            }
                        };
                        return { content: [{ type: "text", text: JSON.stringify(structuredOutput, null, 2) }] };
                    } catch (err: any) {
                        return { content: [{ type: "text", text: `⚠️ Login failed: ${err.message}` }] };
                    }
                }
                return wrapError(`Error generating summary: ${e.message}`);
            }
        }
    },
    {
        name: "ask_question",
        schema: z.object({
            question: z.string().describe("The question to ask"),
            url: z.string().optional().describe("Optional: The YouTube URL. If omitted, uses the last accessed notebook."),
            target_topic: z.string().optional().describe("Optional: A keyword or alias to switch context (e.g., 'gaming').")
        }),
        handler: async ({ question, url, target_topic }: { question: string, url?: string, target_topic?: string }) => {
            const { catalog } = await import("./catalog.js");

            // 1. Resolve Target Notebook
            let notebook;
            if (url) {
                // Explicit URL provided
                notebook = catalog.getNotebookByUrl(url);
            } else if (target_topic) {
                // Topic switch
                notebook = catalog.findNotebook(target_topic);
                if (!notebook) {
                    const allTopics = catalog.listNotebooks().map(n => n.title || n.aliases[0] || "Untitled").join(", ");
                    return { content: [{ type: "text", text: `I couldn't find a notebook for '${target_topic}'. Known topics: ${allTopics}` }] };
                }
            } else {
                // Default to last accessed
                notebook = catalog.getLastAccessed();
                if (!notebook) {
                    return { content: [{ type: "text", text: "I don't have a active notebook context. Please provide a url to start." }] };
                }
            }

            // Determine URL to use
            const targetUrl = url || notebook?.videoUrl;
            if (!targetUrl) return wrapError("Could not resolve a video URL.");

            // Update Access Time
            if (notebook) catalog.touch(notebook.id);

            logToFile(`[MCP] Request: Question for ${targetUrl}: "${question}"`);

            try {
                const client = await getClient();
                const answer = await client.query(targetUrl, question);
                return { content: [{ type: "text", text: answer }] };
            } catch (e: any) {
                if (e.message.includes("Authentication required")) {
                    const loginClient = new NotebookLMClient(false);
                    try {
                        await loginClient.openLoginWindow();
                        try { await loginClient.stop(); } catch { }
                        const retryClient = await getClient();
                        const answer = await retryClient.query(targetUrl, question);
                        return { content: [{ type: "text", text: answer }] };
                    } catch (err: any) {
                        return { content: [{ type: "text", text: `⚠️ Login failed: ${err.message}` }] };
                    }
                }
                return wrapError(`Error asking question: ${e.message}`);
            }
        }
    },
    {
        name: "list_notebooks",
        schema: z.object({}),
        handler: async () => {
            const { catalog } = await import("./catalog.js");
            const notebooks = catalog.listNotebooks();
            const summary = notebooks.map(n => `- **${n.title}** (Aliases: ${n.aliases.join(", ")}) [${n.videoUrl}]`).join("\n");
            return { content: [{ type: "text", text: `**Available Notebooks:**\n\n${summary || "No notebooks found."}` }] };
        }
    },
    {
        name: "add_note_to_notebook",
        schema: z.object({
            text: z.string().describe("The text note to add."),
            target: z.string().optional().describe("Optional: video URL or topic keyword.")
        }),
        handler: async ({ text, target }: { text: string, target?: string }) => {
            const { catalog } = await import("./catalog.js");
            let notebook;
            if (target) {
                if (target.startsWith("http")) notebook = catalog.getNotebookByUrl(target);
                else notebook = catalog.findNotebook(target);
            } else {
                notebook = catalog.getLastAccessed();
            }

            if (!notebook) return wrapError("No notebook found to add note to.");

            catalog.touch(notebook.id);

            const client = await getClient();
            try {
                await client.query(notebook.videoUrl, `[SYSTEM: User added a note] ${text}`);
                return { content: [{ type: "text", text: `Note added to '${notebook.title}'.` }] };
            } catch (e: any) {
                return wrapError("Failed to add note: " + e.message);
            }
        }
    },
    {
        name: "delete_notebook",
        schema: z.object({
            target: z.string().describe("The video URL or topic keyword of the notebook to delete.")
        }),
        handler: async ({ target }: { target: string }) => {
            const { catalog } = await import("./catalog.js");
            let notebook;
            if (target.startsWith("http")) notebook = catalog.getNotebookByUrl(target);
            else notebook = catalog.findNotebook(target);

            if (!notebook) return wrapError(`No notebook found for '${target}'.`);

            logToFile(`[MCP] Request: Delete notebook '${notebook.title}' (${notebook.id})`);

            try {
                const client = await getClient();
                // 1. Delete from NotebookLM (Cloud)
                await client.deleteNotebook(notebook.id);

                // 2. Delete from Local Catalog
                catalog.removeNotebook(notebook.id);

                return { content: [{ type: "text", text: `✅ Successfully deleted notebook: "${notebook.title}"` }] };
            } catch (e: any) {
                return wrapError(`Failed to delete notebook: ${e.message}`);
            }
        }
    }
];

// Special App Tool Definition (kept separate due to registerAppTool Helper)
export const infographicToolDef = {
    name: "generate_infographic",
    description: "Generates a visual infographic for a YouTube video using NotebookLM.",
    schema: z.object({
        url: z.string().describe("The URL of the YouTube video"),
    }),
    handler: async ({ url }: { url: string }, extra: any) => {
        logToFile(`[MCP] Request: Infographic for ${url}`);
        try {
            const client = await getClient();

            let step = 0;
            // Generate Infographic
            const dataUri = await client.generateInfographic(url, async (status) => {
                step++;
                try {
                    const progressToken = extra?._meta?.progressToken;
                    if (progressToken && extra?.sendNotification) {
                        await extra.sendNotification({
                            method: "notifications/progress",
                            params: {
                                progressToken: progressToken,
                                progress: step,
                                total: 100
                            }
                        });
                    }

                    if (extra?.sendNotification) {
                        await extra.sendNotification({
                            method: "notifications/message",
                            params: {
                                level: "info",
                                logger: "notebooklm",
                                data: status
                            }
                        });
                    }
                    logToFile(`[Progress] ${status}`);
                } catch (e) { }
            });

            const responseContent: any[] = [
                {
                    type: "text",
                    text: `Infographic generated successfully!\n\n**URL**: ${dataUri}`
                }
            ];

            if (dataUri.startsWith("http")) {
                // SKIP BASE64 FOR REST (ChatGPT/API) TO PREVENT ResponseTooLargeError
                if (extra?.isRest) {
                    logToFile("[REST] Skipping base64 image download for REST client to save bandwidth.");
                    responseContent.push({
                        type: "text",
                        text: `\n\n*(Note: High-resolution image available at the link above)*`
                    });
                } else {
                    try {
                        const imageBytes = await client.downloadResource(dataUri);
                        const processedBuffer = await sharp(imageBytes, { failOnError: false })
                            .resize({ width: 1024, withoutEnlargement: true })
                            .jpeg({ quality: 85 })
                            .toBuffer();

                        responseContent.push({
                            type: "image",
                            data: processedBuffer.toString('base64'),
                            mimeType: "image/jpeg"
                        });

                    } catch (err: any) {
                        logToFile(`Image processing failed (returning text-only): ${err.message}`);
                        responseContent.push({
                            type: "text",
                            text: `\n\n*(Image processing failed, but here is the link: ${dataUri})*`
                        });
                    }
                }
            }
            return { content: responseContent };

        } catch (e: any) {
            logToFile(`Error generating infographic: ${e.message}`);
            return wrapError(`Error: ${e.message}`);
        }
    }
};

/**
 * Registers all tools and resources to the given McpServer instance.
 */
export async function registerTools(server: McpServer) {
    // --- Register App Resource ---
    registerAppResource(server, resourceUri, resourceUri, { mimeType: RESOURCE_MIME_TYPE }, async () => {
        logToFile(`[MCP] Resource requested: ${resourceUri}`);
        try {
            const htmlPath = path.join(__dirname, "../../dist/src/mcp-app.html");
            logToFile(`[MCP] Serving UI from: ${htmlPath}`);
            const html = await fsPromises.readFile(htmlPath, "utf-8");
            return {
                contents: [
                    { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
                ],
            };
        } catch (e) {
            logToFile(`Failed to read mcp-app.html: ${e}`);
            throw e;
        }
    });

    // Register Standard Tools using loop
    for (const def of toolDefinitions) {
        server.tool(def.name, def.schema, def.handler);
    }

    // Register Infographic Tool (App Tool Helper)
    logToFile("Registering tool: generate_infographic");
    registerAppTool(
        server,
        infographicToolDef.name,
        {
            title: "Generate Infographic",
            description: infographicToolDef.description,
            inputSchema: infographicToolDef.schema as any,
            _meta: { ui: { resourceUri } },
        },
        infographicToolDef.handler
    );
}
