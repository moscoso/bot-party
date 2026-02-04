import { ProviderType, AgentMode } from "./providers";

export type PlayerId = string;

export type PlayerSecret =
    | { kind: "SPY" }
    | { kind: "CIVILIAN"; location: string; role: string };

export type Player = {
    id: PlayerId;
    name: string;
    isHuman: boolean;
    secret: PlayerSecret;
};

export type Turn = {
    askerId: PlayerId;
    targetId: PlayerId;
    question: string;
    answer: string;
};

/** Configuration for a single player slot */
export type PlayerSlotConfig = 
    | { type: "human" }
    | { type: ProviderType; mode: AgentMode };

export type GameConfig = {
    rounds: number; // number of Q/A turns (not "full cycles")
    /** Player configurations in order. If not provided, uses legacy config. */
    playerSlots?: PlayerSlotConfig[];
    // Legacy config (used if playerSlots not provided)
    numPlayers?: number;
    includeHuman?: boolean;
    agentMode?: AgentMode;
    providers?: ProviderType[];
};
