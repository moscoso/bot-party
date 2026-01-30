import { Player, Turn } from "../types";

export type AskResult = { targetName: string; question: string; thought?: string; };

/**
 * Reaction payload request context (last exchange)
 */
export type ReactContext = {
  askerId: string;
  targetId: string;
  question: string;
  answer: string;
};

export type QuestionReactContext = {
  askerId: string;
  targetId: string;
  question: string;
};

/** A player is either AI or human */
export interface PlayerController {
    ask(players: Player[], self: Player): Promise<AskResult>;
    answer(askerName: string, question: string): Promise<string>;
    guessLocation(turns: Turn[], self: Player): Promise<string | null>;
    vote(players: Player[], turns: Turn[], self: Player): Promise<string>; 
    react(players: Player[], turns: Turn[], self: Player, last: ReactContext): Promise<string>;
    reactToQuestion(players: Player[], turns: Turn[], self: Player, q: QuestionReactContext): Promise<string>;
}
