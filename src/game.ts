import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { allLocationsList, LOCATIONS } from "./data";
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
    return s.trim().toLowerCase();
}

/** * Resolve a target by name.
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

    // Logic: Illegal if target is self OR target is the person who just asked you
    const isIllegal = (p: Player) => p.id === selfId || (lastAskerId && p.id === lastAskerId);

    // If the chosen candidate is valid, use them
    if (candidate && !isIllegal(candidate)) {
        return candidate;
    }

    // Fallback: Filter all players to find those who are legal targets
    const validOptions = players.filter(p => !isIllegal(p));

    // Safety check: if everyone is illegal (rare), just pick someone not self
    if (validOptions.length === 0) {
        return safePickRandom(players.filter(p => p.id !== selfId), players[0]);
    }

    return safePickRandom(validOptions, validOptions[0]);
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
                const secret: PlayerSecret = (i === spyIndex)
                    ? { kind: "SPY" }
                    : { kind: "CIVILIAN", location: pack.location, role: roles.pop() || "Visitor" };

                players.push({ id: name, name, isHuman, secret });
            }

            const controllers = new Map<PlayerId, PlayerController>();
            for (const p of players) {
                controllers.set(p.id, p.isHuman
                    ? new HumanController(this.rl)
                    : new AIController(new Agent(p.name, buildPlayerSystemPrompt(p.name, p.secret)))
                );
            }

            const human = players.find(p => p.isHuman);
            if (human) console.log(`\n=== YOUR IDENTITY ===\n${secretToBrief(human.secret)}\n=====================\n`);

            const turns: Turn[] = [];

            // --- DYNAMIC TURN SETUP ---
            let roundCount = 0;
            let currentAsker = pickRandom(players);
            let lastAsker: Player | null = null;

            console.log(`🚀 Game started! ${currentAsker.name} will ask the first question.`);

            // Using a while loop for dynamic flow
            while (roundCount < config.rounds) {
                roundCount++;
                const askerCtl = controllers.get(currentAsker.id)!;

                // 1. ASKER CHOOSES TARGET & QUESTION
                const rawAsk = await askerCtl.ask(players, currentAsker);
                // Note: Assuming 'ask' returns the raw AI string or an object containing it
                const askerThought = rawAsk.thought;
                const targetName = rawAsk.targetName;
                const question = rawAsk.question;

                // Log Asker's Thought
                if (askerThought) console.log(`\n💭 ${currentAsker.name}'s Strategy: "${askerThought}"`);

                // 2. RESOLVE TARGET
                const target = resolveOtherPlayer(players, targetName, currentAsker.id, lastAsker?.id);
                const targetCtl = controllers.get(target.id)!;

                // 3. TARGET ANSWERS
                const rawAnswer = await targetCtl.answer(currentAsker.name, question);

                // Parse the components
                const targetThought = parseField("THOUGHT", rawAnswer);
                const publicAnswer = parseField("ANSWER", rawAnswer) || rawAnswer; // Fallback if parse fails

                // Log Target's Thought
                if (targetThought) console.log(`💭 ${target.name}'s Logic: "${targetThought}"`);

                // 4. RECORD & LOG PUBLIC TRANSCRIPT
                turns.push({ askerId: currentAsker.name, targetId: target.name, question, answer: publicAnswer });

                console.log(`\n[Round ${roundCount}] ${currentAsker.name} ➔ ${target.name}`);
                console.log(`Q: ${question}`);
                console.log(`A: ${publicAnswer}`);

                // 5. UPDATE STATE
                lastAsker = currentAsker;
                currentAsker = target;
            }

            // 2. VOTING
            console.log("\n=== 🗳️ VOTING PHASE ===");
            const votes = new Map<string, number>();
            for (const p of players) {
                const rawVote = await controllers.get(p.id)!.vote(players, turns, p);
                const thought = parseField("THOUGHT", rawVote);
                const voteName = parseField("VOTE", rawVote);
                const why = parseField("WHY", rawVote);

                if (thought) console.log(`\n💭 ${p.name}'s Voting Logic: "${thought}"`);

                const candidates = players.filter(x => x.id !== p.id);
                const validCandidate = candidates.find(x => normalizeName(x.name) === normalizeName(voteName));
                const finalVote = validCandidate?.name || safePickRandom(candidates, players[0]).name;

                votes.set(finalVote, (votes.get(finalVote) || 0) + 1);
                console.log(`${p.name} voted for: ${finalVote} (${why})`);
            }

            // 3. TALLY & REVEAL
            const sortedVotes = [...votes.entries()].sort((a, b) => b[1] - a[1]);
            const isTie = sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1];
            const accusedName = isTie ? null : sortedVotes[0][0];
            const spy = players.find(p => p.secret.kind === "SPY")!;

            console.log(`\n⚖️ VERDICT: ${isTie ? "A tie! The group is paralyzed by doubt." : `The group accuses ${accusedName}!`}`);
            console.log(`🕵️ REVEAL: The Spy was indeed ${spy.name}!`);

            // 4. THE SPY'S REDEMPTION GUESS
            let spyGuessedRight = false;
            if (accusedName === spy.name || isTie) {
                console.log(`\n${spy.name} attempts a final guess...`);
                const guessRaw = await controllers.get(spy.id)!.guessLocation(turns, spy) ?? "";
                const guess = parseField("GUESS", guessRaw);
                const reason = parseField("REASON", guessRaw);

                console.log(`${spy.name}: "I believe we are at the ${guess.toUpperCase()}!"`);
                if (reason) console.log(`Reason: "${reason}"`);

                spyGuessedRight = normalizeName(guess) === normalizeName(pack.location);
            }

            // 5. FINAL SCORE
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