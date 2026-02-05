# NotebookLM MCP Server

A powerful **Model Context Protocol (MCP)** server that connects AI assistants (like Claude & ChatGPT) to **Google's NotebookLM**.

It enables your AI to:
- 📊 **Generate Visual Infographics** from YouTube videos.
- 📝 **Summarize Content** with strict verbatim accuracy (no hallucinations).
- 💬 **Chat with Notebooks** using context-aware Q&A.

---

## 🚀 Features

### 1. Visual Infographic Generation
Creates beautiful, downloadable infographics from any YouTube video URL.
- **Asynchronous:** Handles complex generation without timeouts.
- **Smart Viewer:** Returns an interactive UI to view and download the image.

### 2. Strict Verbatim Summaries
Examples often rewrite content. This server uses a **Structured Authority Protocol** to ensure that summaries are displayed **exactly** as NotebookLM generated them, maintaining 100% fidelity to the source.

### 3. Context-Aware Intelligence
- **Session Persistence:** Remembers your active notebook so you don't have to keep pasting URLs.
- **Implicit Context:** Ask "What does *it* say about X?" and it understands "it" refers to the current video.

### 4. Robust Management
- **Manual Login Mode:** Visually log in to your Google account if cookies expire.
- **Port Management:** Automatically handles port 3000 conflicts.
- **Auto-Recovery:** Detects and fixes browser crashes instantly.

---

## 🛠️ Prerequisites

Before you start, ensure you have:
1.  **Node.js** (v20+ installed)
2.  **Google Account** (active logic for NotebookLM)
3.  **Ngrok Account** (if you want to share the server via public URL)

---

## ⚙️ Installation & Setup

### 1. Install Dependencies
Open a terminal in the project folder and run:
```bash
npm install
npm install -g ngrok
```

### 2. Authenticate with Google (First Time Only)
Since NotebookLM requires a Google account, you need to log in once.
```bash
npm run login
```
1.  A Chrome window will open.
2.  **Log in** to your Google account.
3.  Once the "NotebookLM" dashboard loads, **close the window**.
4.  Your session is now saved locally!

---

## ▶️ Running the Server

You have two ways to start the server:

### Option A: The Double-Click Method (Easiest)
Simply double-click the `start_server.bat` file in the folder.
- This creates a window that keeps the server running.
- **Keep this window open** while using the server.

### Option B: The Terminal Method
Run this command in your terminal:
```bash
npm start
```
*The server is now live on `localhost:3000`.*

---

## 🔗 How to Connect

### 1. Claude Desktop (Local App)
To use this with the Claude Desktop app on your computer, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "c:\\Users\\vishw\\OneDrive\\Desktop\\Altrosyn_Projects\\Summary-Infographic-Final-stHTTP\\node_modules\\.bin\\tsx.cmd",
      "args": [
        "c:\\Users\\vishw\\OneDrive\\Desktop\\Altrosyn_Projects\\Summary-Infographic-Final-stHTTP\\src\\server.ts"
      ]
    }
  }
}
```
> **⚠️ CRITICAL:** You MUST use the **Absolute Path** (full path starting with `C:\`) to your project folder, as shown above. Relative paths (`src/server.ts`) will fail.

### 2. Public Deployment (Sharing with Founder/Team)
To let someone else access your running server (e.g., from their ChatGPT or Claude):

1.  Start the server (Method A or B above).
2.  Run this command in a terminal:
    ```bash
    ngrok http 3000
    ```
3.  Copy the **Forwarding URL** (e.g., `https://example.ngrok-free.app`).

**Connection Details for Remote User:**
- **MCP Endpoint:** `https://your-url.ngrok-free.app/sse`

---
