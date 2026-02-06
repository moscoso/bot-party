import { LOCATIONS } from "../data";
import type { Player } from "../types";
import type { GameConfig } from "../types";
import type { EarlyEndResult } from "../types";
import type { LocationPack } from "../data";

export function emitGameInfo(
    pack: LocationPack,
    players: Player[],
    config: GameConfig,
    onGameInfo?: (info: { location: string; allLocations: string[]; roles: string[]; players: Array<{ name: string; role: string; isSpy: boolean }>; config: GameConfig }) => void
): void {
    if (!onGameInfo) return;

    const allLocs = LOCATIONS.map(l => l.location);
    const playerInfo = players.map(p => ({
        name: p.name,
        role: p.secret.kind === "SPY" ? "SPY" : p.secret.role,
        isSpy: p.secret.kind === "SPY",
    }));

    onGameInfo({
        location: pack.location,
        allLocations: allLocs,
        roles: pack.roles,
        players: playerInfo,
        config,
    });
}

export function printEarlyEndResult(
    pack: LocationPack,
    spy: Player,
    result: EarlyEndResult & { ended: true },
    log: (msg: string) => void
): void {
    log("\n" + "=".repeat(30));
    log(`📍 ACTUAL LOCATION: ${pack.location}`);
    log(`🕵️ THE SPY WAS: ${spy.name}`);
    if (result.winner === "spy") {
        log(`🏆 RESULT: SPY WINS! (${result.reason})`);
    } else {
        log(`🏆 RESULT: CIVILIANS WIN! (${result.reason})`);
    }
    log("=".repeat(30) + "\n");
}

export function logVerdict(
    accusedName: string | null,
    isTie: boolean,
    spy: Player,
    log: (msg: string) => void
): void {
    log(`\n⚖️ VERDICT: ${isTie ? "A tie! The group is paralyzed by doubt." : `The group accuses ${accusedName}!`}`);
    log(`🕵️ REVEAL: The Spy was indeed ${spy.name}!`);
}

export function printFinalScore(
    pack: LocationPack,
    accusedName: string | null,
    spy: Player,
    spyGuessedRight: boolean,
    log: (msg: string) => void
): void {
    log("\n" + "=".repeat(30));
    log(`📍 ACTUAL LOCATION: ${pack.location}`);
    if (spyGuessedRight) {
        log("🏆 RESULT: SPY WINS! (Correctly identified the location)");
    } else if (accusedName === spy.name) {
        log("🏆 RESULT: CIVILIANS WIN! (Spy was caught)");
    } else {
        log("🏆 RESULT: SPY WINS! (Total deception)");
    }
    log("=".repeat(30) + "\n");
}
