import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { GameConfig } from "./types";
import type { PromptEntry, AgentCreatedEntry } from "./agent";
import {
    setupGame,
    runQuestionRounds,
    runVotingPhase,
    tallyVotes,
    runSpyGuessIfEligible,
} from "./phases";
import {
    emitGameInfo,
    printEarlyEndResult,
    logVerdict,
    printFinalScore,
} from "./utils/output";

export type GameReporter = (line: string) => void;

export type GameInfoEntry = {
    location: string;
    allLocations: string[];
    roles: string[];
    players: Array<{ name: string; role: string; isSpy: boolean }>;
    config: GameConfig;
};

export class SpyfallGame {
    private rl: ReturnType<typeof readline.createInterface> | null = null;
    private running = false;

    public onOutput?: GameReporter;
    public onPrompt?: (entry: PromptEntry) => void;
    public onGameInfo?: (info: GameInfoEntry) => void;
    public onAgentCreated?: (entry: AgentCreatedEntry) => void;

    private log(msg: string): void {
        console.log(msg);
        this.onOutput?.(msg);
    }

    async run(config: GameConfig) {
        if (this.running) return;
        this.running = true;
        if (config.includeHuman) {
            this.rl = readline.createInterface({ input, output });
        }

        let agents: import("./agent").Agent[] = [];
        try {
            const setup = await setupGame(config, {
                rl: this.rl,
                onPrompt: this.onPrompt,
                onAgentCreated: this.onAgentCreated,
            });
            const { pack, players, controllers, agents: setupAgents } = setup;
            agents = setupAgents;
            const spy = players.find(p => p.secret.kind === "SPY")!;

            emitGameInfo(pack, players, config, this.onGameInfo);
            agents.forEach(a => a.emitCreated());

            const allowEarlyVote = config.allowEarlyVote ?? true;
            const ctx = { log: this.log.bind(this) };
            const { turns, earlyEnd } = await runQuestionRounds(
                config.rounds,
                players,
                controllers,
                pack,
                allowEarlyVote,
                ctx
            );

            if (earlyEnd.ended) {
                printEarlyEndResult(pack, spy, earlyEnd, this.log.bind(this));
            } else {
                const votes = await runVotingPhase(players, controllers, turns, ctx);
                const { accusedName, isTie } = tallyVotes(votes, players);
                logVerdict(accusedName, isTie, spy, this.log.bind(this));
                const spyGuessedRight = await runSpyGuessIfEligible(
                    accusedName,
                    isTie,
                    spy,
                    pack,
                    controllers,
                    turns,
                    ctx
                );
                printFinalScore(pack, accusedName, spy, spyGuessedRight, this.log.bind(this));
            }
        } finally {
            await Promise.all(agents.map(a => a.cleanup()));
            this.rl?.close();
            this.rl = null;
            this.running = false;
        }
    }
}
