import { Player } from "../types";
import type { PlayerController } from "../controllers";
import type { LogContext } from "./types";

export async function collectReactions(
    reactors: Player[],
    controllers: Map<Player["id"], PlayerController>,
    eventType: "question" | "answer",
    authorName: string,
    content: string,
    ctx: LogContext
): Promise<void> {
    if (reactors.length === 0) return;

    const { log } = ctx;
    const reactions = await Promise.all(
        reactors.map(async (p) => {
            const ctl = controllers.get(p.id)!;
            const result = await ctl.react(eventType, authorName, content, p);
            return { name: p.name, ...result };
        })
    );

    const validReactions = reactions.filter(r => r.emoji && r.reaction);
    if (validReactions.length > 0) {
        for (const r of validReactions) {
            log(`  ${r.emoji} ${r.name}: "${r.reaction}"`);
            if (r.suspicion) log(`     ↳ ${r.suspicion}`);
        }
    }
}
