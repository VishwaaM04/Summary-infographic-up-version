
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    // Exact same path logic as client
    const userDataDir = path.resolve(__dirname, "..", "notebooklm_profile");
    console.log(`Checking profile at: ${userDataDir}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true, // Try headless first as that's where issue is
        args: [
            "--disable-blink-features=AutomationControlled",
        ]
    });

    try {
        const page = await context.newPage();
        await page.goto("https://notebooklm.google.com");

        // Wait a moment for any auto-login or redirects
        await page.waitForTimeout(5000);

        const cookies = await context.cookies("https://notebooklm.google.com");

        console.log(`Found ${cookies.length} cookies.`);

        const debugFile = path.resolve(process.cwd(), "cookie_snapshot.json");
        fs.writeFileSync(debugFile, JSON.stringify(cookies, null, 2));
        console.log(`Cookies dumped to: ${debugFile}`);

        // Check specifically for auth cookies
        const callbackCookie = cookies.find(c => c.name.startsWith("__Secure-"));
        if (callbackCookie) {
            console.log("✅ Secure Auth cookies detected.");
        } else {
            console.log("❌ NO Secure Auth cookies found! You are likely logged out.");
        }

        const title = await page.title();
        console.log(`Page Title: ${title}`);

        if (title.includes("Sign in") || page.url().includes("accounts.google.com")) {
            console.log("❌ DETECTED LOGIN PAGE. Persistence failed or session expired.");
        }

    } catch (e) {
        console.error("Error inspecting cookies:", e);
    } finally {
        await context.close();
    }
}

main();
