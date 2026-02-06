import { Player } from "../types";
import { parseField } from "../utils/parseField";
import { normalizeName } from "../utils/normalizeName";
import type { LogContext } from "./types";
import type { LocationPack } from "../data";
import type { PlayerController } from "../controllers";
import type { Turn } from "../types";
import type { EarlyEndResult } from "../types";

export async function handleEarlySpyGuess(
    spy: Player,
    pack: LocationPack,
    controllers: Map<Player["id"], PlayerController>,
    turns: Turn[],
    ctx: LogContext
): Promise<EarlyEndResult> {
    const { log } = ctx;
    log(`\n🎲 ${spy.name} is taking a risk and guessing the location!`);

    const guessRaw = await controllers.get(spy.id)!.guessLocation(turns, spy, false) ?? "";
    const guess = parseField("GUESS", guessRaw);
    const reason = parseField("REASON", guessRaw);

    log(`${spy.name}: "I believe we are at the ${guess.toUpperCase()}!"`);
    if (reason) log(`Reason: "${reason}"`);

    const correct = normalizeName(guess) === normalizeName(pack.location);

    if (correct) {
        return { ended: true, winner: "spy", reason: "Spy correctly guessed the location!" };
    }
    return { ended: true, winner: "civilians", reason: "Spy guessed wrong!" };
}
