import { Agent } from "../agent";
import { buildAskerInstruction, parseField, buildAnswerInstruction, buildSpyGuessPrompt, buildVotePrompt } from "../prompts";
import { Player, Turn } from "../types";
import { PlayerController, AskResult, ReactContext, QuestionReactContext } from "./player.controller";


export class AIController implements PlayerController {
    constructor(private agent: Agent) { }

    async ask(players: Player[], self: Player): Promise<AskResult> {
        const raw = await sayWithRetry(
            this.agent,
            buildAskerInstruction(players, self),
            looksLikeAskPayload,
            FORMAT_REMINDER_ASK
        );

        const targetNameRaw = parseField(raw, "TARGET");
        const question = parseField(raw, "QUESTION");
        const thought = parseField(raw, "THOUGHT") || undefined;

        // Hard validity: if target isn't a real player name, default to the first non-self player
        const resolvedTarget =
            resolveToValidPlayerName(players, targetNameRaw) ??
            players.find(p => p.name !== self.name)?.name ??
            players[0]?.name ??
            "Agent0";

        return {
            targetName: resolvedTarget,
            question: ensureNonEmpty(question, "What’s the first thing you do when you arrive here?"),
            thought
        };
    }

    async answer(askerName: string, question: string): Promise<string> {
        return await this.agent.say(buildAnswerInstruction(askerName, question));
    }

    async guessLocation(turns: Turn[], self: Player): Promise<string | null> {
        if (self.secret.kind !== "SPY") return null;

        const raw = await sayWithRetry(
            this.agent,
            buildSpyGuessPrompt(turns),
            looksLikeGuessPayload,
            FORMAT_REMINDER_GUESS
        );

        // Return raw so your engine can parseField("GUESS"/"REASON") consistently
        return raw;
    }

    async vote(players: Player[], turns: Turn[], self: Player): Promise<string> {
        const raw = await sayWithRetry(
            this.agent,
            buildVotePrompt(players, turns, self.name),
            looksLikeVotePayload,
            FORMAT_REMINDER_VOTE
        );

        // Normalize VOTE to a valid candidate if possible (prevents garbage votes)
        const voteNameRaw = parseField(raw, "VOTE");
        const resolved = resolveToValidPlayerName(
            players.filter(p => p.name !== self.name),
            voteNameRaw
        );

        if (!resolved) {
            // Patch the VOTE field in-place by appending a correction line (keeps WHY/THOUGHT)
            const fallback = players.find(p => p.name !== self.name)?.name ?? players[0]?.name ?? "Agent0";
            const why = parseField(raw, "WHY") || "best guess";
            const thought = parseField(raw, "THOUGHT");

            return [
                thought ? `THOUGHT: ${thought}` : "",
                `VOTE: ${fallback}`,
                `WHY: ${why}`
            ]
                .filter(Boolean)
                .join("\n");
        }

        return raw;
    }

    /**
    * NEW: reaction to the QUESTION (not the answer).
    * This is the missing “beat” for tension:
    * Strategy -> Question -> (question reactions) -> target strategy -> Answer -> (answer reactions)
    *
    * Output schema:
    * Q_TAG: SAFE | RISKY | TRAP | BLAND
    * Q_NOTE: <one sentence>
    */
    async reactToQuestion(
        players: Player[],
        turns: Turn[],
        self: Player,
        q: QuestionReactContext
    ): Promise<string> {
        const raw = await sayWithRetry(
            this.agent,
            buildQuestionReactionPrompt(players, turns, self, q),
            looksLikeQuestionReactionPayload,
            FORMAT_REMINDER_Q_REACT
        );

        const tagRaw = parseField(raw, "Q_TAG").toUpperCase();
        const tagOk = ["SAFE", "RISKY", "TRAP", "BLAND"].includes(tagRaw) ? tagRaw : "BLAND";

        const note = parseField(raw, "Q_NOTE");

        return [`Q_TAG: ${tagOk}`, `Q_NOTE: ${ensureNonEmpty(note, "No strong read.")}`].join("\n");
    }


    async react(players: Player[], turns: Turn[], self: Player, last: ReactContext): Promise<string> {
        const raw = await sayWithRetry(
            this.agent,
            buildReactionPrompt(players, turns, self, last),
            looksLikeReactionPayload,
            FORMAT_REMINDER_REACT
        );

        // Light normalization: clamp DELTA if present, and ensure TAG is one of the allowed set.
        const tagRaw = parseField(raw, "TAG").toUpperCase();
        const tagOk = ["LEGIT", "OFF", "NOSIGNAL", "RED"].includes(tagRaw) ? tagRaw : "NOSIGNAL";

        const suspectRaw = parseField(raw, "SUSPECT");
        const suspectResolved = suspectRaw ? resolveToValidPlayerName(players, suspectRaw) : null;

        const deltaRaw = parseField(raw, "DELTA");
        const deltaParsed = deltaRaw ? clampInt(parseInt(deltaRaw, 10), -2, 2) : 0;

        const note = parseField(raw, "NOTE");

        return [
            `TAG: ${tagOk}`,
            `SUSPECT: ${suspectResolved ?? ""}`,
            `DELTA: ${deltaParsed}`,
            `NOTE: ${ensureNonEmpty(note, "No strong signal.")}`
        ].join("\n");
    }
}

function normalizeName(s: string): string {
    return (s ?? "").trim().toLowerCase();
}

function clampInt(n: number, min: number, max: number): number {
    const x = Number.isFinite(n) ? Math.trunc(n) : 0;
    return Math.max(min, Math.min(max, x));
}

function listPlayerNames(players: Player[]): string {
    return players.map(p => p.name).join(", ");
}


function ensureNonEmpty(raw: string | undefined | null, fallback: string): string {
    const v = (raw ?? "").trim();
    return v.length ? v : fallback;
}

function looksLikeAskPayload(raw: string): boolean {
    const t = parseField(raw, "TARGET");
    const q = parseField(raw, "QUESTION");
    return t.length > 0 && q.length > 0;
}

function looksLikeVotePayload(raw: string): boolean {
    const v = parseField(raw, "VOTE");
    const w = parseField(raw, "WHY");
    return v.length > 0 && w.length > 0;
}

function looksLikeGuessPayload(raw: string): boolean {
    const g = parseField(raw, "GUESS");
    return g.length > 0;
}

function looksLikeReactionPayload(raw: string): boolean {
    const tag = parseField(raw, "TAG");
    const delta = parseField(raw, "DELTA");
    // TAG is the main requirement; DELTA optional, but we nudge for it.
    return tag.length > 0 || delta.length > 0;
}

function looksLikeQuestionReactionPayload(raw: string): boolean {
  const tag = parseField(raw, "Q_TAG");
  const note = parseField(raw, "Q_NOTE");
  return tag.length > 0 || note.length > 0;
}

/**
 * If the model gives a non-matching name, we can still force it into a valid player name.
 */
function resolveToValidPlayerName(players: Player[], name: string): string | null {
    const n = normalizeName(name);
    if (!n) return null;
    return players.find(p => normalizeName(p.name) === n)?.name ?? null;
}

/**
 * One retry with a strict formatting reminder.
 */
async function sayWithRetry(
    agent: Agent,
    prompt: string,
    isOk: (raw: string) => boolean,
    formatReminder: string
): Promise<string> {
    const raw1 = await agent.say(prompt);
    if (isOk(raw1)) return raw1;

    const raw2 = await agent.say(`${prompt}\n\n${formatReminder}`);
    return raw2;
}

/** --------------------- prompts built here --------------------- */
function buildQuestionReactionPrompt(
  players: Player[],
  turns: Turn[],
  self: Player,
  q: QuestionReactContext
): string {
  const recent = turns.slice(Math.max(0, turns.length - 6));
  const recentLines = recent
    .map((t, i) => `- ${i + 1}. ${t.askerId} ➔ ${t.targetId} | Q: ${t.question} | A: ${t.answer}`)
    .join("\n");

  return `
You are ${self.name}.
You are playing SPYFALL. Do NOT reveal hidden info. Output ONLY the required fields.

Players: ${listPlayerNames(players)}

A question was just asked (BEFORE any answer):
Asker: ${q.askerId}
Target: ${q.targetId}
Q: ${q.question}

Recent context (last ~6 turns):
${recentLines || "(none)"}

TASK:
Give an immediate gut reaction to the QUESTION itself (not the answer).
Choose ONE tag:
- SAFE: low risk / generic / unlikely to expose anyone
- RISKY: could expose someone (including asker) if answered wrong
- TRAP: very targeted, fishing for lived experience / routine detail
- BLAND: weak question, low signal

Write one short sentence explaining why, max ~14 words.
Do NOT mention hidden roles or locations.
Do NOT speculate what the answer will be.

OUTPUT FORMAT (EXACTLY):
Q_TAG: <SAFE|RISKY|TRAP|BLAND>
Q_NOTE: <one sentence>
`.trim();
}

/**
 * Build a STRICT prompt for reactions.
 * This is intentionally short and “schema-first” so you can edit later.
 */
function buildReactionPrompt(players: Player[], turns: Turn[], self: Player, last: ReactContext): string {
    const recent = turns.slice(Math.max(0, turns.length - 6));
    const recentLines = recent
        .map((t, i) => `- ${i + 1}. ${t.askerId} ➔ ${t.targetId} | Q: ${t.question} | A: ${t.answer}`)
        .join("\n");

    return `
You are ${self.name}.
You are playing SPYFALL. Do NOT reveal hidden info. Output ONLY the required fields.

Players: ${listPlayerNames(players)}

Last exchange:
Asker: ${last.askerId}
Target: ${last.targetId}
Q: ${last.question}
A: ${last.answer}

Recent context (last ~6 turns):
${recentLines || "(none)"}

TASK:
Give a *single* quick reaction as if you are watching that exchange.
- TAG meaning:
  - LEGIT = sounded authentic / lived-in
  - OFF = sounded inconsistent / slightly wrong
  - NOSIGNAL = nothing learned
  - RED = major tell / big suspicion
- SUSPECT: name of the person you're reacting to (usually the TARGET; can be blank)
- DELTA: how your suspicion changes toward SUSPECT (-2..2). Use 0 if none.
- NOTE: one sentence max, no more than ~18 words.

OUTPUT FORMAT (EXACTLY):
TAG: <LEGIT|OFF|NOSIGNAL|RED>
SUSPECT: <player name or blank>
DELTA: <-2..2>
NOTE: <one sentence>
`.trim();
}

const FORMAT_REMINDER_ASK = `
FORMAT REQUIREMENTS (EXACT):
TARGET: <one player name from the list>
QUESTION: <one short question>
THOUGHT: <optional, one short sentence>
Do NOT include anything else.
`.trim();

const FORMAT_REMINDER_VOTE = `
FORMAT REQUIREMENTS (EXACT):
THOUGHT: <optional, one short sentence>
VOTE: <one player name from the list>
WHY: <one short sentence>
Do NOT include anything else.
`.trim();

const FORMAT_REMINDER_GUESS = `
FORMAT REQUIREMENTS (EXACT):
GUESS: <location name>
REASON: <one short sentence>
Do NOT include anything else.
`.trim();

const FORMAT_REMINDER_REACT = `
FORMAT REQUIREMENTS (EXACT):
TAG: <LEGIT|OFF|NOSIGNAL|RED>
SUSPECT: <player name or blank>
DELTA: <-2..2>
NOTE: <one sentence>
Do NOT include anything else.
`.trim();

const FORMAT_REMINDER_Q_REACT = `
FORMAT REQUIREMENTS (EXACT):
Q_TAG: <SAFE|RISKY|TRAP|BLAND>
Q_NOTE: <one sentence>
Do NOT include anything else.
`.trim();