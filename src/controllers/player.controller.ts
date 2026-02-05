import { ActionChoice, Player, Turn } from "../types";

export type AccusationResult = { targetName: string; reason: string; thought?: string; };
export type DefenseResult = { defense: string; thought?: string; };

export type AccusationVoteResult = { vote: "yes" | "no"; reason: string; };
export type AskResult = { targetName: string; question: string; thought?: string; };
export type ReactionResult = { emoji: string; reaction: string; suspicion: string };

export interface PlayerController {
    /** Accuse someone of being the spy (early accusation) */
    accuse(players: Player[], turns: Turn[], self: Player): Promise<AccusationResult>;
    /** Defend yourself when accused */
    defendAgainstAccusation(accuserName: string, accusation: string, turns: Turn[], self: Player): Promise<DefenseResult>;
    ask(players: Player[], self: Player): Promise<AskResult>;
    answer(askerName: string, question: string, self: Player): Promise<string>;
    /** Choose an action for this turn (only called after all players have answered once) */
    chooseAction(players: Player[], turns: Turn[], self: Player, canAccuse: boolean): Promise<ActionChoice>;
    /** When 'early', spy is voluntarily guessing mid-game. When 'caught', spy was convicted and gets one last chance. */
    guessLocation(turns: Turn[], self: Player, whenCaught?: boolean): Promise<string | null>;
    react(eventType: "question" | "answer", authorName: string, content: string, self: Player): Promise<ReactionResult>;
    /** Final voting phase - vote for who you think is the spy */
    vote(players: Player[], turns: Turn[], self: Player): Promise<string>;    
    /** Vote yes/no on someone else's accusation */
    voteOnAccusation(accuserName: string, accusedName: string, defense: string, turns: Turn[], self: Player): Promise<AccusationVoteResult>;
}
