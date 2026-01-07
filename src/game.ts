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
    return s.trim().toLowerCase();
}

/** Resolve a target by name, but never allow selecting self; always fall back to a valid alternative. */
function resolveOtherPlayer(players: Player[], targetName: string, excludeId: PlayerId): Player {
    const byName = players.find(p => normalizeName(p.name) === normalizeName(targetName));
    if (byName && byName.id !== excludeId) return byName;

    const notSelf = players.filter(p => p.id !== excludeId);
    return safePickRandom(notSelf, players.find(p => p.id !== excludeId) ?? players[0]);
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
            const order = shuffle(players);

            // 1. QUESTION ROUNDS
            for (let r = 0; r < config.rounds; r++) {
                const asker = order[r % order.length];
                const askerCtl = controllers.get(asker.id)!;
                const result = await askerCtl.ask(players, asker);
                
                const target = resolveOtherPlayer(players, result.targetName, asker.id);
                const answer = await controllers.get(target.id)!.answer(asker.name, result.question);

                turns.push({ askerId: asker.name, targetId: target.name, question: result.question, answer });
                console.log(`\n[Turn ${r + 1}] ${asker.name} ➔ ${target.name}\nQ: ${result.question}\nA: ${answer}`);
            }

            // 2. VOTING
            console.log("\n=== 🗳️ VOTING PHASE ===");
            const votes = new Map<string, number>();
            for (const p of players) {
                const rawVote = await controllers.get(p.id)!.vote(players, turns, p);
                const voteName = parseField("VOTE", rawVote);
                const validCandidate = players.find(x => normalizeName(x.name) === normalizeName(voteName) && x.id !== p.id);
                const finalVote = validCandidate?.name || safePickRandom(players.filter(x => x.id !== p.id), players[0]).name;
                
                votes.set(finalVote, (votes.get(finalVote) || 0) + 1);
                console.log(`${p.name} voted for: ${finalVote}`);
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