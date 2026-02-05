
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "../core/tools.js";
import { logToFile } from "../core/logger.js";

export async function startStdioServer() {
    logToFile("Starting STDIO Server...");
    const stdioServer = new McpServer({
        name: "NotebookLM",
        version: "1.0.0",
    });

    await registerTools(stdioServer);

    const stdioTransport = new StdioServerTransport();
    await stdioServer.connect(stdioTransport);

    logToFile("NotebookLM MCP Server running on Stdio");
}
