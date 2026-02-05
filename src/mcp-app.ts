
import { App } from "@modelcontextprotocol/ext-apps";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const viewerEl = document.getElementById("viewer")!;
const statusEl = document.getElementById("status")!;

const app = new App({ name: "NotebookLM Infographic", version: "1.0.0" });

// Check for transport configuration in URL
const urlParams = new URLSearchParams(window.location.search);
const transportType = urlParams.get("transport");
const serverUrl = urlParams.get("url") || "http://localhost:3000/sse";

// Establish communication with the host
if (transportType === "http") {
    console.log(`Connecting via StreamableHTTPClientTransport to ${serverUrl}...`);
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    app.connect(transport);
} else {
    // Default to PostMessage (Claude Desktop / Host)
    console.log("Connecting via default PostMessage (Host)...");
    app.connect();
}


// Handle the initial tool result pushed by the host
app.ontoolresult = (result) => {
    console.log("Tool Result:", result);
    renderResult(result);
};


// Handle Notifications
(app as any).onnotification = (notification: any) => {
    console.log("Notification:", notification);

    if (notification.method === "notifications/progress") {
        const { progress, total } = notification.params;
        updateProgress(progress, total);
    }

    if (notification.method === "notifications/message") {
        const { data } = notification.params;
        addLog(data);
    }
};

const progressContainer = document.getElementById("progress-container")!;
const progressBar = document.getElementById("progress-bar")!;
const progressText = document.getElementById("progress-text")!;
const logsContainer = document.getElementById("logs")!;

function updateProgress(current: number, total: number) {
    statusEl.style.display = "none";
    progressContainer.style.display = "block";
    logsContainer.style.display = "block";

    const percentage = Math.min(100, Math.max(0, (current / (total || 100)) * 100));
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `Progress: ${Math.round(percentage)}%`;
}

function addLog(msg: string) {
    const p = document.createElement("div");
    p.textContent = `> ${msg}`;
    p.style.borderBottom = "1px solid #ddd";
    p.style.padding = "2px 0";
    logsContainer.prepend(p);
}


function renderResult(result: any) {
    if (!result || !result.content) return;

    // Look for Image content
    const imagePart = result.content.find((c: any) => c.type === "image");

    if (imagePart) {
        statusEl.style.display = 'none';
        progressContainer.style.display = 'none'; // Hide progress on completion
        // logsContainer.style.display = 'none'; // Keep logs or hide? Let's keep for validation.

        viewerEl.innerHTML = '';

        const img = document.createElement('img');
        const src = `data:${imagePart.mimeType};base64,${imagePart.data}`;
        img.src = src;
        img.style.maxWidth = "100%";
        img.style.borderRadius = "8px";
        img.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";

        viewerEl.appendChild(img);

        const link = document.createElement('a');
        link.href = src;
        link.download = "infographic.jpg";
        link.textContent = "Download Image";
        link.style.display = "block";
        link.style.marginTop = "10px";
        link.style.color = "#4CAF50";
        viewerEl.appendChild(link);

    } else {
        // Fallback for text
        const textPart = result.content.find((c: any) => c.type === "text");
        if (textPart) {
            statusEl.textContent = textPart.text;
        }
    }
}

