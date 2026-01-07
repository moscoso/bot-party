import { allLocationsList } from "./data";
import { Player, PlayerSecret, Turn } from "./types";

export function secretToBrief(secret: PlayerSecret): string {
    if (secret.kind === "SPY") return "🕵️ YOU ARE THE SPY. You do NOT know the location. Blend in!";
    return `📍 Location: ${secret.location}\n👤 Your role: ${secret.role}`;
}

export function buildPlayerSystemPrompt(name: string, secret: PlayerSecret): string {
    const common = `
        You are playing Spyfall in a group chat.

        All possible locations in this game are:
        ${allLocationsList()}

        Rules:
        - If you are NOT the spy: you know the location. Answer questions naturally without being too obvious.
        - If you ARE the spy: you do not know the location. Infer it from others' answers.
        - Never explicitly reveal the location name.
        - Keep answers natural (1–3 sentences). Stay in-character.
        - Prefer vague, indirect phrasing.
        `;

    const personal = `\nYour name is ${name}.\n${secretToBrief(secret)}\n`;
    return common + personal;
}

export function buildAskerInstruction(players: Player[], self: Player): string {
    const names = players.map(p => p.name).filter(n => n !== self.name).join(", ");
    return `
        Players you can ask: ${names}
        Your job: Ask ONE clever question to ONE player to gather info.
        Return exactly:
        TARGET: <player name>
        QUESTION: <your question>
    `;
}

export function buildAnswerInstruction(askerName: string, question: string): string {
    return `${askerName} asked you: "${question}"\nAnswer appropriately for Spyfall (1-3 sentences).`;
}

export function buildSpyGuessPrompt(turns: Turn[]): string {
    const recap = turns
        .map(t => `${t.askerId} -> ${t.targetId}\nQ: ${t.question}\nA: ${t.answer}`)
        .join("\n\n");
    return `
        You have been caught! This is your final chance to win. 
        Based on the transcript, guess the location. Be dramatic.
        Reply exactly with:
        GUESS: <location name>
        REASON: <one sentence explaining what clue gave it away>

    Transcript:
    ${recap}`;
}

export function buildVotePrompt(players: Player[], turns: Turn[], selfName: string): string {
    const recap = turns
        .map(t => `${t.askerId} asked ${t.targetId}: ${t.question}\nAnswer: ${t.answer}`)
        .join("\n\n");

    const names = players.map(p => p.name).filter(n => n !== selfName).join(", ");
    return `
        Review the transcript. Who is the SPY? 
        Candidates: ${names}
        Reply exactly with:
        VOTE: <player name>
        WHY: <one sentence reasoning>

    Transcript:
    ${recap}`;
}

/**
 * Extracts a specific value from a block of text based on a "KEY: VALUE" format.
 * 
 * This utility uses a case-insensitive {@link RegExp} to 
 * locate the key name and capture all text following the colon on the same line.
 *
 * @param key - The name of the key to search for (e.g., "TARGET", "GUESS", "VOTE").
 * @param text - the raw string to search within
 * @returns the trimmed string value of the field if found; otherwise, an empty string.
 * * @example
 * const aiResponse = "I've decided.\nTARGET: Agent1\nQUESTION: What is the weather?";
 * const target = parseField("TARGET", aiResponse); // Returns "Agent1"
 */
export function parseField(key: string, text: string): string {
    // Creates a regex like /KEY:\s*(.*)/i
    // - i: case-insensitive
    // - \s*: ignores optional spaces after the colon
    // - (.*): captures the rest of the text on that line
    const regex = new RegExp(`${key}:\\s*(.*)`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
}