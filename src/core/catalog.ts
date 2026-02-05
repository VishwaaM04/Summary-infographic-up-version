import * as fs from 'fs';
import * as path from 'path';

export interface NotebookEntry {
    id: string;         // NotebookLM ID
    sourceId: string;   // The primary source ID
    title: string;      // User-friendly title or inferred from video title
    aliases: string[];  // Keywords like "gaming", "tutorial", etc.
    lastAccessed: number;
    videoUrl: string;
}

const CATALOG_FILE = path.join(process.cwd(), "notebook_catalog.json");

export class Catalog {
    private notebooks: NotebookEntry[] = [];

    constructor() {
        this.load();
    }

    private load() {
        if (fs.existsSync(CATALOG_FILE)) {
            try {
                this.notebooks = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8'));
            } catch (e) {
                console.error("Failed to load catalog:", e);
                this.notebooks = [];
            }
        }
    }

    private save() {
        try {
            fs.writeFileSync(CATALOG_FILE, JSON.stringify(this.notebooks, null, 2));
        } catch (e) {
            console.error("Failed to save catalog:", e);
        }
    }

    public addNotebook(entry: NotebookEntry) {
        const existingIndex = this.notebooks.findIndex(n => n.id === entry.id);
        if (existingIndex >= 0) {
            // Update existing
            this.notebooks[existingIndex] = { ...this.notebooks[existingIndex], ...entry, lastAccessed: Date.now() };
        } else {
            this.notebooks.push({ ...entry, lastAccessed: Date.now() });
        }
        this.save();
    }

    public removeNotebook(id: string) {
        this.notebooks = this.notebooks.filter(n => n.id !== id);
        this.save();
    }

    public getNotebook(id: string): NotebookEntry | undefined {
        return this.notebooks.find(n => n.id === id);
    }

    public getNotebookByUrl(url: string): NotebookEntry | undefined {
        return this.notebooks.find(n => n.videoUrl === url);
    }

    public findNotebook(query: string): NotebookEntry | undefined {
        const q = query.toLowerCase();
        // 1. Check aliases
        let match = this.notebooks.find(n => n.aliases.some(a => a.toLowerCase().includes(q)));
        if (match) return match;

        // 2. Check title
        match = this.notebooks.find(n => n.title.toLowerCase().includes(q));
        if (match) return match;

        // 3. Check for broad keywords in title/alias if valid?
        // (Simple implementation first)
        return undefined;
    }

    public getLastAccessed(): NotebookEntry | undefined {
        if (this.notebooks.length === 0) return undefined;
        return this.notebooks.sort((a, b) => b.lastAccessed - a.lastAccessed)[0];
    }

    public touch(id: string) {
        const entry = this.getNotebook(id);
        if (entry) {
            entry.lastAccessed = Date.now();
            this.save();
        }
    }

    public listNotebooks(): NotebookEntry[] {
        return [...this.notebooks].sort((a, b) => b.lastAccessed - a.lastAccessed);
    }
}

// Singleton
export const catalog = new Catalog();
