
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { WebSocketServer } from "ws";

import { WebSocketServerTransport } from "../ws_transport.js";
import { registerTools } from "../core/tools.js";
import { logToFile } from "../core/logger.js";
import express from "express";
import * as path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startHttpServer() {
    logToFile("Starting HTTP/WS Server...");

    const app = createMcpExpressApp({
        host: '0.0.0.0'
    });

    // Add a health check
    app.get("/health", (req, res) => {
        res.json({ status: "ok" });
    });

    // --- GENERIC REST API ADAPTER (ChatGPT / Universal LLM Support) ---
    const { toolDefinitions, infographicToolDef } = await import("../core/tools.js");

    // Merge standard tools with the special infographic tool for API/OpenAPI purposes
    const allTools = [...toolDefinitions, infographicToolDef];

    // 1. OpenAPI Spec Endpoint
    app.get("/openapi.json", (req, res) => {
        const paths: any = {};

        allTools.forEach(tool => {
            paths[`/api/tools/${tool.name}`] = {
                post: {
                    operationId: tool.name,
                    summary: tool.description || tool.name,
                    description: tool.description,
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: Object.keys(tool.schema.shape || {}).filter(k => !tool.schema.shape[k].isOptional()),
                                    properties: (() => {
                                        if (!tool.schema || !tool.schema.shape) return {};
                                        return Object.keys(tool.schema.shape).reduce((acc: any, key) => {
                                            const field = tool.schema.shape[key];
                                            acc[key] = {
                                                type: "string",
                                                description: field.description
                                            };
                                            return acc;
                                        }, {});
                                    })()
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Successful response",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            content: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        type: { type: "string" },
                                                        text: { type: "string" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
        });

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['host'];
        const fullUrl = `${protocol}://${host}`;

        res.json({
            openapi: "3.1.0",
            info: {
                title: "NotebookLM MCP Server",
                version: "1.0.5-debug",
                description: "API for NotebookLM interactions (Summary, Q&A, Infographics)"
            },
            servers: [
                { url: fullUrl }
            ],
            paths: paths
        });
    });

    // 2. Generic Tool Routes
    app.use(express.json()); // Ensure JSON body parsing

    allTools.forEach(tool => {
        app.post(`/api/tools/${tool.name}`, async (req, res) => {
            logToFile(`[REST] Call: ${tool.name} | Body: ${JSON.stringify(req.body)}`);
            try {
                // MCP Tools expect { argName: value }, which matches standard JSON body
                const result = await tool.handler(req.body, {
                    isRest: true,
                    sendNotification: async (n: any) => {
                        // Optional: could stream progress via SSE if we were fancy, but for now just log
                        logToFile(`[REST Progress] ${JSON.stringify(n)}`);
                    }
                });
                res.json(result);
            } catch (e: any) {
                res.status(500).json({ error: e.message });
            }
        });
    });


    // Use http.createServer to attach listeners BEFORE .listen()
    // This allows catching EADDRINUSE synchronously/immediately
    const httpServer = http.createServer(app);

    httpServer.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE') {
            const msg = "❌ Port 3000 is already in use. HTTP/WS features will be disabled, but STDIO is active.";
            logToFile(msg);
            console.error(msg); // Send to STDERR so Claude sees it cleanly
        } else {
            console.error("HTTP Server Error:", e);
        }
    });

    httpServer.listen(3000, '0.0.0.0', () => {
        logToFile("HTTP/WS Server listening on port 3000");
    });

    // Serve Static Files for Browser Testing
    // Serve the dist directory so assets (js/css) can be loaded
    app.use("/static", express.static(path.join(__dirname, "../../dist")));

    // Map the Resource URI path to the actual HTML file for direct browser access
    app.get("/ui/infographic/view.html", (req, res) => {
        const eventualPath = path.join(__dirname, "../../dist/src/mcp-app.html");
        res.sendFile(eventualPath);
    });

    // Setup HTTP Server (SSE + POST)
    const httpServerMcp = new McpServer({
        name: "NotebookLM",
        version: "1.0.0",
    });
    await registerTools(httpServerMcp);

    const httpTransport = new StreamableHTTPServerTransport();
    await httpServerMcp.connect(httpTransport);

    // UNIFIED ENDPOINT: /mcp
    app.get("/mcp", async (req, res) => {
        logToFile("New SSE connection attempt via /mcp");
        await httpTransport.handleRequest(req, res);
    });

    app.post("/mcp", async (req, res) => {
        await httpTransport.handleRequest(req, res);
    });

    // Setup WebSocket
    const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
    wss.on("connection", async (ws) => {
        logToFile("New WebSocket connection");
        const wsServer = new McpServer({
            name: "NotebookLM",
            version: "1.0.0",
        });
        await registerTools(wsServer);
        const wsTransport = new WebSocketServerTransport(ws);
        await wsServer.connect(wsTransport);

        ws.on("close", () => {
            wsServer.close();
        });
    });
}
