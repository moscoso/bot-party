import { Agent } from "../agent";
import { parseField } from "../game";
import { 
    buildAccusationPrompt, 
    buildAccusationVotePrompt, 
    buildActionChoicePrompt, 
    buildAnswerInstruction, 
    buildAskerInstruction, 
    buildDefensePrompt, 
    buildEarlySpyGuessPrompt, 
    buildReactionPrompt, 
    buildSpyGuessPrompt, 
    buildVotePrompt, 
} from "../prompts";
import { ActionChoice, Player, Turn, TurnAction } from "../types";
import { PlayerController, AskResult, ReactionResult, AccusationResult, AccusationVoteResult, DefenseResult } from "./player.controller";

export class AIController implements PlayerController {
    constructor(private agent: Agent) {}

    async chooseAction(players: Player[], turns: Turn[], self: Player, canAccuse: boolean): Promise<ActionChoice> {
        const raw = await this.agent.say(buildActionChoicePrompt(players, turns, self, canAccuse), "choose action");
        const thought = parseField("THOUGHT", raw);
        const actionRaw = parseField("ACTION", raw).toLowerCase();
        
        // Parse action, defaulting to question if invalid
        let action: TurnAction = "question";
        if (actionRaw.includes("guess") && self.secret.kind === "SPY") {
            action = "guess";
        } else if ((actionRaw.includes("accuse") || actionRaw.includes("vote")) && canAccuse) {
            action = "vote"; // "vote" action type now means "accuse"
        }
        
        return { action, thought };
    }

    async ask(players: Player[], self: Player): Promise<AskResult> {
        const askText = await this.agent.say(buildAskerInstruction(players, self), "ask a question");
        return {
            targetName: parseField("TARGET", askText),
            question: parseField("QUESTION", askText),
            thought: parseField("THOUGHT", askText)
        };
    }

    async answer(askerName: string, question: string, self: Player): Promise<string> {
        return await this.agent.say(buildAnswerInstruction(askerName, question, self.secret), "answer a question");
    }

    async guessLocation(turns: Turn[], self: Player, whenCaught = true): Promise<string | null> {
        if (self.secret.kind !== "SPY") return null;
        const prompt = whenCaught ? buildSpyGuessPrompt(turns) : buildEarlySpyGuessPrompt(turns);
        return await this.agent.say(prompt, "guess the location");
    }

    async vote(players: Player[], turns: Turn[], self: Player): Promise<string> {
        return await this.agent.say(buildVotePrompt(players, turns, self.name), "vote");
    }

    async accuse(players: Player[], turns: Turn[], self: Player): Promise<AccusationResult> {
        const raw = await this.agent.say(buildAccusationPrompt(players, turns, self), "vote");
        return {
            targetName: parseField("TARGET", raw),
            reason: parseField("REASON", raw),
            thought: parseField("THOUGHT", raw),
        };
    }

    async defendAgainstAccusation(accuserName: string, accusation: string, turns: Turn[], self: Player): Promise<DefenseResult> {
        const raw = await this.agent.say(buildDefensePrompt(accuserName, accusation, turns, self), "vote");
        return {
            defense: parseField("DEFENSE", raw) || raw,
            thought: parseField("THOUGHT", raw),
        };
    }

    async voteOnAccusation(accuserName: string, accusedName: string, defense: string, turns: Turn[], self: Player): Promise<AccusationVoteResult> {
        const raw = await this.agent.say(buildAccusationVotePrompt(accuserName, accusedName, defense, turns, self), "vote");
        const voteRaw = parseField("VOTE", raw).toLowerCase();
        const vote = voteRaw.includes("yes") ? "yes" : "no";
        return {
            vote,
            reason: parseField("REASON", raw),
        };
    }

    async react(eventType: "question" | "answer", authorName: string, content: string, self: Player): Promise<ReactionResult> {
        const raw = await this.agent.say(buildReactionPrompt(eventType, authorName, content, self.secret), "react");
        return {
            emoji: parseField("EMOJI", raw) || "🤔",
            reaction: parseField("REACTION", raw) || raw,
            suspicion: parseField("SUSPICION", raw) || "",
        };
    }
}