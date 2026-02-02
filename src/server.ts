import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PromptEntry, AgentCreatedEntry } from "./agent";
import { SpyfallGame, type GameInfoEntry } from "./game";
import type { GameConfig } from "./types";

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
    const agentMode = params.get("mode") === "thread" ? "thread" : "memory";

    const config: GameConfig = {
        numPlayers: 3,
        includeHuman: false,
        rounds: 9,
        agentMode,
    };

    const game = new SpyfallGame();
    game.onOutput = broadcast;
    game.onPrompt = broadcastPrompt;
    game.onGameInfo = broadcastGameInfo;
    game.onAgentCreated = broadcastAgentCreated;

    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: `Game started (mode: ${agentMode}). Watch the stream.` }));

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

function serveHtml(res: ServerResponse): void {
    const path = join(__dirname, "..", "public", "index.html");
    const html = readFileSync(path, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const [path, queryString] = url.split("?");

    if (path === "/api/stream" && req.method === "GET") {
        handleStream(res);
        return;
    }
    if (path === "/api/start" && req.method === "POST") {
        void handleStart(res, queryString ?? "");
        return;
    }
    if (path === "/" && req.method === "GET") {
        serveHtml(res);
        return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Open in a browser, then click Start game to stream a run.");
});
