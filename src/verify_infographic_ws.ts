
import WebSocket from 'ws';

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const url = "ws://localhost:3000/ws";
    console.log(`Connecting to ${url}...`);
    const ws = new WebSocket(url);

    ws.on('open', async () => {
        console.log('Connected to WebSocket');

        // 1. Initialize
        const initReq = {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "verifier", version: "1.0" }
            }
        };
        ws.send(JSON.stringify(initReq));
    });

    ws.on('message', async (data) => {
        const msg = JSON.parse(data.toString());
        console.log('Received:', JSON.stringify(msg, null, 2));

        if (msg.id === 1 && msg.result) {
            console.log("Initialized!");
            // 2. Send initialized notification
            ws.send(JSON.stringify({
                jsonrpc: "2.0",
                method: "notifications/initialized"
            }));

            // 3. Call tool
            console.log("Calling generate_infographic...");
            const toolReq = {
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: {
                    name: "generate_infographic",
                    arguments: {
                        video_url: "https://www.youtube.com/watch?v=6Af6b_wyiwI"
                    },
                    _meta: { progressToken: "test-progress-token" }
                }
            };
            ws.send(JSON.stringify(toolReq));
        }

        if (msg.id === 2) {
            if (msg.error) {
                console.error("Tool execution failed:", msg.error);
            } else {
                console.log("Tool execution successful!");
            }
            // Close after result
            setTimeout(() => {
                ws.close();
                process.exit(0);
            }, 1000);
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket Error:', err);
        process.exit(1);
    });
}

main();
