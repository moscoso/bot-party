import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { LOCATIONS } from "./data";
import { Agent } from "./agent";
import { AIController, HumanController, PlayerController } from "./controllers";
import { GameConfig, Player, PlayerId, PlayerSecret, Turn } from "./types";
import { parseField, buildPlayerSystemPrompt, secretToBrief } from "./prompts";

/** ---------- small utilities ---------- */

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function safePickRandom<T>(arr: T[], fallback: T): T {
    return arr.length ? pickRandom(arr) : fallback;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function normalizeName(s: string): string {
    return (s ?? "").trim().toLowerCase();
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function isSpy(p: Player): boolean {
    return p.secret.kind === "SPY";
}

function ensureField(raw: string, field: string): string | null {
    const v = parseField(field, raw);
    return v && v.trim().length ? v.trim() : null;
}

/**
 * Resolve a target by name.
 * Enforces:
 * 1. Target is not the asker (selfId)
 * 2. Target is not the person who just asked (lastAskerId)
 */
function resolveOtherPlayer(
    players: Player[],
    targetName: string,
    selfId: PlayerId,
    lastAskerId?: PlayerId
): Player {
    const normalized = normalizeName(targetName);
    const candidate = players.find(p => normalizeName(p.name) === normalized);

    const isIllegal = (p: Player) => p.id === selfId || (lastAskerId && p.id === lastAskerId);

    if (candidate && !isIllegal(candidate)) {
        return candidate;
    }

    const validOptions = players.filter(p => !isIllegal(p));

    if (validOptions.length === 0) {
        return safePickRandom(players.filter(p => p.id !== selfId), players[0]);
    }

    return safePickRandom(validOptions, validOptions[0]);
}

/**
 * Retry wrapper: if a controller returns malformed output, nudge once.
 */
async function withFormatRetry<T>(
    fn: () => Promise<T>,
    isBad: (t: T) => boolean,
    onRetry: () => void,
    maxRetry = 1
): Promise<T> {
    let last = await fn();
    for (let i = 0; i < maxRetry && isBad(last); i++) {
        onRetry();
        last = await fn();
    }
    return last;
}

/** ---------- reactions (for producer editing + suspicion arcs) ---------- */

type ReactionTag = "LEGIT" | "OFF" | "NOSIGNAL" | "RED";

type Reaction = {
    reactorId: PlayerId;
    tag: ReactionTag;
    suspect?: PlayerId;
    suspicionDelta?: number; // -2..2
    note?: string; // 1 sentence max
};

type TurnEx = Turn & {
    askerThought?: string;
    targetThought?: string;
    reactions?: Reaction[];
};

function otherPlayers(players: Player[], excludeIds: PlayerId[]): Player[] {
    const ex = new Set(excludeIds);
    return players.filter(p => !ex.has(p.id));
}

/**
 * Expected reaction format (your AIController will enforce this):
 * TAG: LEGIT|OFF|NOSIGNAL|RED
 * SUSPECT: AgentX|You|<blank>
 * DELTA: -2..2
 * NOTE: <one sentence>
 */
function parseReaction(raw: string, players: Player[]): Omit<Reaction, "reactorId"> {
    const tagRaw = ensureField(raw, "TAG") ?? "NOSIGNAL";
    const tag = (["LEGIT", "OFF", "NOSIGNAL", "RED"].includes(tagRaw) ? tagRaw : "NOSIGNAL") as ReactionTag;

    const suspectName = ensureField(raw, "SUSPECT");
    const suspect = suspectName
        ? players.find(p => normalizeName(p.name) === normalizeName(suspectName))?.id
        : undefined;

    const deltaRaw = ensureField(raw, "DELTA");
    const suspicionDelta = deltaRaw ? clamp(parseInt(deltaRaw, 10), -2, 2) : 0;

    const note = (ensureField(raw, "NOTE") ?? "").slice(0, 160) || undefined;

    return { tag, suspect, suspicionDelta, note };
}

/** ---------- Game Engine ---------- */

export class SpyfallGame {
    private rl: ReturnType<typeof readline.createInterface> | null = null;
    private running = false;

    async run(config: GameConfig) {
        if (this.running) return;
        this.running = true;
        this.rl = readline.createInterface({ input, output });

        try {
            const pack = pickRandom(LOCATIONS);
            const spyIndex = Math.floor(Math.random() * config.numPlayers);
            const roles = shuffle(pack.roles).slice(0, config.numPlayers - 1);

            const players: Player[] = [];
            for (let i = 0; i < config.numPlayers; i++) {
                const isHuman = config.includeHuman && i === 0;
                const name = isHuman ? "You" : `Agent${i}`;
                const secret: PlayerSecret =
                    i === spyIndex
                        ? { kind: "SPY" }
                        : { kind: "CIVILIAN", location: pack.location, role: roles.pop()! };

                players.push({ id: name, name, isHuman, secret });
            }

            const controllers = new Map<PlayerId, PlayerController>();
            for (const p of players) {
                controllers.set(
                    p.id,
                    p.isHuman
                        ? new HumanController(this.rl)
                        : new AIController(new Agent(p.name, buildPlayerSystemPrompt(p.name, p.secret)))
                );
            }

            const human = players.find(p => p.isHuman);
            if (human) console.log(`\n=== YOUR IDENTITY ===\n${secretToBrief(human.secret)}\n=====================\n`);

            const turns: TurnEx[] = [];

            // --- DYNAMIC TURN SETUP ---
            let roundCount = 0;
            let currentAsker = pickRandom(players);
            let lastAsker: Player | null = null;

            console.log(`🚀 Game started! ${currentAsker.name} will ask the first question.`);

            while (roundCount < config.rounds) {
                roundCount++;
                const askerCtl = controllers.get(currentAsker.id)!;

                // 1) ASKER CHOOSES TARGET & QUESTION (retry if malformed)
                const rawAsk = await withFormatRetry(
                    () => askerCtl.ask(players, currentAsker),
                    (x: any) => !x || !x.question || !x.targetName,
                    () =>
                        console.log(
                            `(format nudge) ${currentAsker.name}: return { targetName, question, thought? }`
                        )
                );

                const askerThought = (rawAsk.thought ?? "").trim() || undefined;
                const targetName = rawAsk.targetName;
                const question = rawAsk.question;

                

                if (askerThought) console.log(`\n
                    \nAsking ${targetName}: "${question}"
                    💭 ${currentAsker.name}'s Strategy: "${askerThought}"`);

                
                const target = resolveOtherPlayer(players, targetName, currentAsker.id, lastAsker?.id);
                const targetCtl = controllers.get(target.id)!;
                // 2) REACTIONS TO QUESTION
                const qReactors = otherPlayers(players, [currentAsker.id, target.id]);

                for (const r of qReactors) {
                const rawQReact = await controllers.get(r.id)!.reactToQuestion(
                    players,
                    turns,
                    r,
                    {
                    askerId: currentAsker.id,
                    targetId: target.id,
                    question
                    }
                );

                const tag = parseField("Q_TAG", rawQReact);
                const note = parseField("Q_NOTE", rawQReact);

                console.log(`🎯 ${r.name} Q_REACT (${tag}): ${note}`);
                }

                // 3) TARGET ANSWERS THE QUESTION
                const rawAnswer = await withFormatRetry(
                    async () => {
                        const a = await targetCtl.answer(currentAsker.name, question);
                        return a;
                    },
                    (a: string) => {
                        const ans = ensureField(a, "ANSWER");
                        // "bad" if no ANSWER and also extremely short / empty
                        return !ans && (a ?? "").trim().length < 5;
                    },
                    () => console.log(`(format nudge) ${target.name}: include ANSWER: ... (optional THOUGHT).`)
                );

                const targetThought = ensureField(rawAnswer, "THOUGHT") ?? undefined;
                const publicAnswer = ensureField(rawAnswer, "ANSWER") ?? (rawAnswer ?? "").trim();

                if (targetThought) console.log(`💭 ${target.name}'s Logic: "${targetThought}"`);

                // 4) RECORD & LOG PUBLIC TRANSCRIPT
                const turn: TurnEx = {
                    askerId: currentAsker.name,
                    targetId: target.name,
                    question,
                    answer: publicAnswer,
                    askerThought,
                    targetThought,
                    reactions: []
                };
                turns.push(turn);

                console.log(`\n[Round ${roundCount}] ${currentAsker.name} ➔ ${target.name}`);
                console.log(`Q: ${question}`);
                console.log(`A: ${publicAnswer}`);

                // 5) REACTIONS (everyone else)
                const reactors = otherPlayers(players, [currentAsker.id, target.id]);
                if (reactors.length) {
                    const reactions: Reaction[] = [];

                    for (const r of reactors) {
                        const ctl = controllers.get(r.id)!;

                        const rawReact = await withFormatRetry(
                            () =>
                                ctl.react(players, turns, r, {
                                    askerId: currentAsker.id,
                                    targetId: target.id,
                                    question,
                                    answer: publicAnswer
                                }),
                            (s: string) => !ensureField(s as unknown as string, "TAG"),
                            () => console.log(`(format nudge) ${r.name}: react with TAG/SUSPECT/DELTA/NOTE.`)
                        );

                        const parsed = parseReaction(rawReact as unknown as string, players);
                        reactions.push({ reactorId: r.id, ...parsed });
                    }

                    turn.reactions = reactions;

                    // Compact “raw footage” log
                    for (const rx of reactions) {
                        const who = players.find(p => p.id === rx.reactorId)!.name;
                        const sus = rx.suspect ? players.find(p => p.id === rx.suspect)?.name : "";
                        const susPart = sus ? ` → ${sus}` : "";
                        const delta = (rx.suspicionDelta ?? 0) ? ` (${rx.suspicionDelta})` : "";
                        const note = rx.note ? `: ${rx.note}` : "";
                        console.log(`🎭 ${who} ${rx.tag}${susPart}${delta}${note}`);
                    }
                }

                // 6) UPDATE STATE
                lastAsker = currentAsker;
                currentAsker = target;
            }

            // VOTING
            console.log("\n=== 🗳️ VOTING PHASE ===");
            const votes = new Map<string, number>();

            for (const p of players) {
                const rawVote = await withFormatRetry(
                    () => controllers.get(p.id)!.vote(players, turns, p),
                    (s: string) => !ensureField(s, "VOTE"),
                    () => console.log(`(format nudge) ${p.name}: include VOTE: <name> and WHY: <short>.`)
                );

                const thought = ensureField(rawVote, "THOUGHT");
                const voteName = ensureField(rawVote, "VOTE") ?? "";
                const why = ensureField(rawVote, "WHY") ?? "no reason given";

                if (thought) console.log(`\n💭 ${p.name}'s Voting Logic: "${thought}"`);

                const candidates = players.filter(x => x.id !== p.id);
                const validCandidate = candidates.find(x => normalizeName(x.name) === normalizeName(voteName));

                // If invalid vote, fall back to highest accumulated suspicion (from reactions), else random.
                let finalVote = validCandidate?.name;

                if (!finalVote) {
                    const suspicion = new Map<PlayerId, number>();
                    for (const t of turns) {
                        for (const rx of t.reactions ?? []) {
                            if (!rx.suspect) continue;
                            suspicion.set(rx.suspect, (suspicion.get(rx.suspect) ?? 0) + (rx.suspicionDelta ?? 0));
                        }
                    }

                    const best = [...suspicion.entries()]
                        .filter(([id]) => id !== p.id)
                        .sort((a, b) => b[1] - a[1])[0]?.[0];

                    finalVote =
                        (best ? players.find(x => x.id === best)?.name : undefined) ??
                        safePickRandom(candidates, candidates[0]).name;
                }

                votes.set(finalVote, (votes.get(finalVote) || 0) + 1);
                console.log(`${p.name} voted for: ${finalVote} (${why})`);
            }

            // TALLY & REVEAL
            const sortedVotes = [...votes.entries()].sort((a, b) => b[1] - a[1]);
            const isTie = sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1];
            const accusedName = isTie ? null : sortedVotes[0][0];
            const spy = players.find(p => p.secret.kind === "SPY")!;

            console.log(
                `\n⚖️ VERDICT: ${
                    isTie ? "A tie! The group is paralyzed by doubt." : `The group accuses ${accusedName}!`
                }`
            );
            console.log(`🕵️ REVEAL: The Spy was indeed ${spy.name}!`);

            // SPY'S REDEMPTION GUESS
            let spyGuessedRight = false;
            if (accusedName === spy.name || isTie) {
                console.log(`\n${spy.name} attempts a final guess...`);
                const guessRaw = (await controllers.get(spy.id)!.guessLocation(turns, spy)) ?? "";
                const guess = ensureField(guessRaw, "GUESS") ?? "";
                const reason = ensureField(guessRaw, "REASON") ?? undefined;

                console.log(`${spy.name}: "I believe we are at the ${guess.toUpperCase()}!"`);
                if (reason) console.log(`Reason: "${reason}"`);

                spyGuessedRight = normalizeName(guess) === normalizeName(pack.location);
            }

            // FINAL SCORE
            console.log("\n" + "=".repeat(30));
            console.log(`📍 ACTUAL LOCATION: ${pack.location}`);
            if (spyGuessedRight) {
                console.log("🏆 RESULT: SPY WINS! (Correctly identified the location)");
            } else if (accusedName === spy.name) {
                console.log("🏆 RESULT: CIVILIANS WIN! (Spy was caught)");
            } else {
                console.log("🏆 RESULT: SPY WINS! (Total deception)");
            }
            console.log("=".repeat(30) + "\n");
        } finally {
            this.rl?.close();
            this.rl = null;
            this.running = false;
        }
    }
}
