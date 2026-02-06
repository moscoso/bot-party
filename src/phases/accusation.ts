import { Player } from "../types";
import { parseField } from "../utils/parseField";
import { normalizeName } from "../utils/normalizeName";
import type { LogContext } from "./types";
import type { LocationPack } from "../data";
import type { PlayerController } from "../controllers";
import type { Turn } from "../types";
import type { EarlyEndResult } from "../types";

export async function handleAccusation(
    accuser: Player,
    players: Player[],
    controllers: Map<Player["id"], PlayerController>,
    turns: Turn[],
    pack: LocationPack,
    ctx: LogContext
): Promise<EarlyEndResult> {
    const { log } = ctx;
    const spy = players.find(p => p.secret.kind === "SPY")!;
    const accuserCtl = controllers.get(accuser.id)!;

    const accusation = await accuserCtl.accuse(players, turns, accuser);
    const accusedName = accusation.targetName;
    const accused = players.find(p => normalizeName(p.name) === normalizeName(accusedName));

    if (!accused || accused.id === accuser.id) {
        log(`${accuser.name} tried to make an invalid accusation. Skipping.`);
        return { ended: false };
    }

    log(`\n🚨 ${accuser.name} accuses ${accused.name} of being the spy!`);
    if (accusation.reason) log(`"${accusation.reason}"`);

    const accusedCtl = controllers.get(accused.id)!;
    const defenseResult = await accusedCtl.defendAgainstAccusation(
        accuser.name,
        accusation.reason || "No reason given",
        turns,
        accused
    );

    log(`\n🛡️ ${accused.name} defends themselves:`);
    if (defenseResult.thought) log(`💭 ${accused.name}'s Strategy: "${defenseResult.thought}"`);
    log(`"${defenseResult.defense}"`);

    const voters = players.filter(p => p.id !== accuser.id && p.id !== accused.id);
    let yesVotes = 1;
    let noVotes = 1;

    log(`\n⚖️ Voting on the accusation...`);
    log(`${accuser.name}: YES (accuser)`);
    log(`${accused.name}: NO (accused)`);

    for (const voter of voters) {
        const voterCtl = controllers.get(voter.id)!;
        const result = await voterCtl.voteOnAccusation(accuser.name, accused.name, defenseResult.defense, turns, voter);

        if (result.vote === "yes") yesVotes++;
        else noVotes++;

        log(`${voter.name}: ${result.vote.toUpperCase()} — "${result.reason}"`);
    }

    const majority = Math.floor(players.length / 2) + 1;
    log(`\n📊 Results: ${yesVotes} YES, ${noVotes} NO (need ${majority} for majority)`);

    if (yesVotes >= majority) {
        log(`✅ The group convicts ${accused.name}!`);
        log(`🕵️ REVEAL: The Spy was ${spy.name}!`);

        if (accused.id === spy.id) {
            log(`\n${spy.name} was caught! But gets one last chance to guess the location...`);
            const guessRaw = await controllers.get(spy.id)!.guessLocation(turns, spy, true) ?? "";
            const guess = parseField("GUESS", guessRaw);
            const reason = parseField("REASON", guessRaw);

            log(`${spy.name}: "I believe we are at the ${guess.toUpperCase()}!"`);
            if (reason) log(`Reason: "${reason}"`);

            const correct = normalizeName(guess) === normalizeName(pack.location);
            if (correct) {
                return { ended: true, winner: "spy", reason: "Spy was caught but correctly guessed the location!" };
            }
            return { ended: true, winner: "civilians", reason: "Spy was caught and couldn't guess the location!" };
        }
        return { ended: true, winner: "spy", reason: `Civilians convicted ${accused.name} but the spy was ${spy.name}!` };
    }

    log(`❌ Not enough votes. ${accused.name} is NOT convicted.`);
    return { ended: false };
}
