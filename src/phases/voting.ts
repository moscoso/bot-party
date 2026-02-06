import { Player } from "../types";
import { parseField } from "../utils/parseField";
import { normalizeName } from "../utils/normalizeName";
import { safePickRandom } from "../utils/random";
import type { LogContext } from "./types";
import type { LocationPack } from "../data";
import type { PlayerController } from "../controllers";
import type { TallyResult } from "./types";
import type { Turn } from "../types";

export async function runVotingPhase(
    players: Player[],
    controllers: Map<Player["id"], PlayerController>,
    turns: Turn[],
    ctx: LogContext
): Promise<Map<string, number>> {
    const { log } = ctx;
    log("\n=== 🗳️ VOTING PHASE ===");
    const votes = new Map<string, number>();

    for (const p of players) {
        const rawVote = await controllers.get(p.id)!.vote(players, turns, p);
        const thought = parseField("THOUGHT", rawVote);
        const voteName = parseField("VOTE", rawVote);
        const why = parseField("WHY", rawVote);

        if (thought) log(`\n💭 ${p.name}'s Voting Logic: "${thought}"`);

        const candidates = players.filter(x => x.id !== p.id);
        const validCandidate = candidates.find(x => normalizeName(x.name) === normalizeName(voteName));
        const finalVote = validCandidate?.name || safePickRandom(candidates, players[0]).name;

        votes.set(finalVote, (votes.get(finalVote) || 0) + 1);
        log(`${p.name} voted for: ${finalVote} (${why})`);
    }

    return votes;
}

export function tallyVotes(votes: Map<string, number>, players: Player[]): TallyResult {
    const sortedVotes = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const isTie = sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1];
    const accusedName = isTie ? null : sortedVotes[0][0];
    const spy = players.find(p => p.secret.kind === "SPY")!;
    return { accusedName, isTie, spy };
}

export async function runSpyGuessIfEligible(
    accusedName: string | null,
    isTie: boolean,
    spy: Player,
    pack: LocationPack,
    controllers: Map<Player["id"], PlayerController>,
    turns: Turn[],
    ctx: LogContext
): Promise<boolean> {
    const { log } = ctx;
    if (accusedName !== spy.name && !isTie) return false;

    log(`\n${spy.name} attempts a final guess...`);
    const guessRaw = await controllers.get(spy.id)!.guessLocation(turns, spy, true) ?? "";
    const guess = parseField("GUESS", guessRaw);
    const reason = parseField("REASON", guessRaw);

    log(`${spy.name}: "I believe we are at the ${guess.toUpperCase()}!"`);
    if (reason) log(`Reason: "${reason}"`);

    return normalizeName(guess) === normalizeName(pack.location);
}
