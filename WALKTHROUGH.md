# Walkthrough - NotebookLM MCP Server
> **Active Branch:** `MCP_app-updates` (Switched from `Updated-ngrok-connected` on Feb 5, 2026)

This server provides a robust integration between AI agents (Claude, ChatGPT) and Google's NotebookLM, featuring strictly verbatim summaries and visual infographic generation.

## 🌟 Key Features
1.  **Strict Verbatim Summaries**: Uses a "Structured Authority" approach to force NotebookLM to return exact quotes without hallucination.
2.  **Infographic Generation**: Creates downloadable visualizations from YouTube videos.
3.  **Hybrid Display**: optimized for ChatGPT, sending both a raw image URL (for Custom GPTs) and a markdown-embedded image (for standard chats).
4.  **Visual Dashboard (MCP Apps)**: A browser-based UI to interact with the server directly.

## 🛠️ Setup & Usage

### 1. Installation
```bash
npm install
npm install -g ngrok
```

### 2. Authentication
Log in once to create your local session profile:
```bash
npm run login
```

### 3. Running the Server
```bash
npm start
```

## 🧩 Technical Highlights

### Infographic Engine
- **Source**: `src/notebooklm_client.ts`
- **Logic**:
    1.  Creates a new Notebook for the video.
    2.  Polls for "Suggested Artifacts".
    3.  Parses the internal "ImageComponent" data.
    4.  Proxies the protected Google image URL via `src/transports/http.ts` to avoiding cookie issues.
- **Timeout**: Extended to 600 seconds (10 minutes) to handle large video processing.

### Image Proxy
- **Route**: `/api/proxy/image.jpg`
- **Purpose**: Bypasses Google's 403 checks by using the server's authenticated session cookies.
- **Trick**: Appends `.jpg` to the URL to force ChatGPT's markdown renderer to display it as an image.

## ✅ Verified Improvements
- Fixed "Login Error" false positives by increasing timeout.
- Resolved `ngrok` connectivity issues by using a static domain.
- Implemented a robust "Dual Response" format for maximum compatibility.

### Verification Recording
![Server Restart & Health Check](media/verify_restart_and_health.webp)
