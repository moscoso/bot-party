import type readlinePromises from "node:readline/promises";
import type { Agent } from "../agent";
import type { Player, PlayerId, Turn, EarlyEndResult } from "../types";
import type { PlayerController } from "../controllers";
import type { LocationPack } from "../data";

export type { LocationPack };

/** Context passed to phases for logging. */
export type LogContext = {
    log: (msg: string) => void;
};

export type GameSetup = {
    pack: LocationPack;
    players: Player[];
    controllers: Map<PlayerId, PlayerController>;
    agents: Agent[];
};

export type RoundsResult = {
    turns: Turn[];
    earlyEnd: EarlyEndResult;
};

export type TallyResult = {
    accusedName: string | null;
    isTie: boolean;
    spy: Player;
};

export type SetupDeps = {
    /** Readline from node:readline/promises (Promise-based .question()). */
    rl: ReturnType<typeof readlinePromises.createInterface> | null;
    onPrompt?: (entry: import("../agent").PromptEntry) => void;
    onAgentCreated?: (entry: import("../agent").AgentCreatedEntry) => void;
};
