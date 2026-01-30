import { allLocationsList } from "./data";
import { Player, PlayerSecret, Turn } from "./types";

/**
 * Converts a {@link PlayerSecret} into a short, player-facing brief.
 * 
 * Spies receive a warning with no location; civilians receive their location and role.
 */
export function secretToBrief(secret: PlayerSecret): string {
    if (secret.kind === "SPY") return "🕵️ YOU ARE THE SPY. You do NOT know the location. Blend in!";
    return `📍 Location: ${secret.location}\n👤 Your role: ${secret.role}`;
}

/**
 * Builds the system prompt that defines a player's identity, tone, and behavior.
 * Enforces casual, punchy Spyfall-style responses and injects role/location context.
 */
export function buildPlayerSystemPrompt(name: string, secret: PlayerSecret): string {
    return `You are playing Spyfall. STOP acting like a boring chat agent. Act like a person playing a party game with personality and/or attitude.
        RULES:
        - NO CORPORATE SPEAK. Be super casual. Talk like high school or college students playing a party game.
        - BE PUNCHY. The less words use the better. 1 sentence is best. Max 15 words.
        - BE VAGUE BUT TANGIBLE. 

        LOCATIONS:
        ${allLocationsList()}

        IDENTITY:
        Name: ${name}
        ${secret.kind === "SPY" ? "YOU ARE THE SPY. Blend in. Everyone is suspicious." : `LOCATION: ${secret.location} / ROLE: ${secret.role}`}
    `;
}

/**
 * Instructs the active player to ask a single strategic question to one other player.
 * Includes guidance for both civilians (trap the spy) and spies (extract information).
 */
export function buildAskerInstruction(players: Player[], self: Player): string {
    const names = players.map(p => p.name).filter(n => n !== self.name).join(", ");
     const tip = self.secret.kind === "SPY"
        ? "TIP: Ask questions that sound normal but secretly narrow down the location. Or ask a question that would draw suspicion to someone else."
        : "TIP: Ask something that a real person at the location would answer naturally. Or ask a weird question to throw off the spy.";
    return `
        Players you can ask: ${names}
        Your job: Ask ONE clever question to ONE player. 
        
        ${tip}

        Return exactly in this format:
            THOUGHT: <your private internal reasoning about who is suspicious or what info you need>
            TARGET: <player name>
            QUESTION: <your question>
    `;
}

/**
 * Instructs a player on how to answer a question asked by another player.
 * Requires internal reasoning plus a short, punchy public answer.
 */
export function buildAnswerInstruction(askerName: string, question: string): string {
    return `
    ${askerName} asked you: "${question}"
        Return exactly in this format:
            THOUGHT: <how you interpreted this question and how you are choosing to hide/reveal info>
            ANSWER: <your punchy, max 15-word answer>
    `;
}

/**
 * Builds the final prompt for a caught spy to guess the location.
 * Includes a full transcript recap and requires justification for the guess.
 */
export function buildSpyGuessPrompt(turns: Turn[]): string {
    const recap = turns
        .map(t => `${t.askerId} -> ${t.targetId}\nQ: ${t.question}\nA: ${t.answer}`)
        .join("\n\n");
    return `
        You have been caught!
        Return exactly in this format:
            THOUGHT: <analyze the transcript and identify the specific clues that led you to your guess>
            GUESS: <location name>
            REASON: <one sentence for the final reveal>

        Transcript:
        ${recap}
    `;
}

/**
 * Builds the voting prompt for players to accuse who they believe is the spy.
 * Includes a transcript recap and requires both private reasoning and a public explanation.
 */
export function buildVotePrompt(players: Player[], turns: Turn[], selfName: string): string {
    const recap = turns
        .map(t => `${t.askerId} asked ${t.targetId}: ${t.question}\nAnswer: ${t.answer}`)
        .join("\n\n");

    const names = players.map(p => p.name).filter(n => n !== selfName).join(", ");
    return `
        Who is the SPY? 
        Return exactly in this format:
            THOUGHT: <your internal analysis of everyone's behavior and answers>
            VOTE: <player name>
            WHY: <one sentence for the public record>

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