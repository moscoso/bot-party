import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PromptEntry, AgentCreatedEntry } from "./agent";
import { SpyfallGame, type GameInfoEntry } from "./game";
import type { GameConfig, PlayerSlotConfig } from "./types";
import { PROVIDER_TYPES, type ProviderType, getProviderCapabilities } from "./providers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

/** SSE clients: each can receive broadcast payloads (full SSE message). */
const sseClients: Set<(payload: string) => void> = new Set();

function broadcast(line: string): void {
    const payload = `event: log\ndata: ${JSON.stringify({ line })}\n\n`;
    for (const send of sseClients) {
        try {
            send(payload);
        } catch {
            // client may have disconnected
        }
    }
}

function broadcastPrompt(entry: PromptEntry): void {
    const payload = `event: prompt\ndata: ${JSON.stringify(entry)}\n\n`;
    for (const send of sseClients) {
        try {
            send(payload);
        } catch {
            // client may have disconnected
        }
    }
}

function broadcastGameInfo(info: GameInfoEntry): void {
    const payload = `event: gameinfo\ndata: ${JSON.stringify(info)}\n\n`;
    for (const send of sseClients) {
        try {
            send(payload);
        } catch {
            // client may have disconnected
        }
    }
}

function broadcastAgentCreated(entry: AgentCreatedEntry): void {
    const payload = `event: agentcreated\ndata: ${JSON.stringify(entry)}\n\n`;
    for (const send of sseClients) {
        try {
            send(payload);
        } catch {
            // client may have disconnected
        }
    }
}

function handleStream(res: ServerResponse): void {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    res.flushHeaders?.();

    const send = (payload: string) => {
        res.write(payload);
        (res as ServerResponse & { flush?: () => void }).flush?.();
    };
    sseClients.add(send);

    res.on("close", () => {
        sseClients.delete(send);
    });
}

async function handleStart(res: ServerResponse, queryString: string): Promise<void> {
    const params = new URLSearchParams(queryString);
    
    const rounds = Math.min(30, Math.max(1, parseInt(params.get("rounds") || "9") || 9));
    
    // Parse players param: "openai:memory,anthropic:memory,human,google:stateful"
    const playersParam = params.get("players");
    let playerSlots: PlayerSlotConfig[] | undefined;
    
    if (playersParam) {
        playerSlots = [];
        const slots = playersParam.split(",").map(s => s.trim());
        for (const slot of slots) {
            if (slot === "human") {
                playerSlots.push({ type: "human" });
            } else {
                const [provider, mode] = slot.split(":");
                if (PROVIDER_TYPES.includes(provider as ProviderType)) {
                    // Map "thread" (legacy) to "stateful"
                    const agentMode = (mode === "stateful" || mode === "thread") ? "stateful" : "memory";
                    playerSlots.push({
                        type: provider as ProviderType,
                        mode: agentMode,
                    });
                }
            }
        }
        // Ensure at least 2 players
        if (playerSlots.length < 2) {
            playerSlots = undefined;
        }
    }

    const config: GameConfig = {
        rounds,
        playerSlots,
    };

    const game = new SpyfallGame();
    game.onOutput = broadcast;
    game.onPrompt = broadcastPrompt;
    game.onGameInfo = broadcastGameInfo;
    game.onAgentCreated = broadcastAgentCreated;

    const numPlayers = playerSlots?.length ?? 3;
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: `Game started with ${numPlayers} players. Watch the stream.` }));

    try {
        await game.run(config);
        broadcast("\n[Game over.]");
    } catch (err) {
        broadcast(`\n[Error: ${err instanceof Error ? err.message : String(err)}]`);
    } finally {
        game.onOutput = undefined;
        game.onPrompt = undefined;
        game.onGameInfo = undefined;
        game.onAgentCreated = undefined;
    }
}

const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
};

function serveStatic(res: ServerResponse, filePath: string): boolean {
    const fullPath = join(__dirname, "..", "public", filePath);
    
    // Security: prevent path traversal
    if (!fullPath.startsWith(join(__dirname, "..", "public"))) {
        return false;
    }
    
    if (!existsSync(fullPath)) {
        return false;
    }
    
    const ext = extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    
    try {
        const content = readFileSync(fullPath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
        return true;
    } catch {
        return false;
    }
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const [path, queryString] = url.split("?");

    if (path === "/api/stream" && req.method === "GET") {
        handleStream(res);
        return;
    }
    if (path === "/api/providers" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(getProviderCapabilities()));
        return;
    }
    if (path === "/api/start" && req.method === "POST") {
        void handleStart(res, queryString ?? "");
        return;
    }
    // Serve static files from public/
    if (req.method === "GET") {
        const filePath = path === "/" ? "index.html" : path.slice(1); // Remove leading /
        if (serveStatic(res, filePath)) {
            return;
        }
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Open in a browser, then click Start game to stream a run.");
});
