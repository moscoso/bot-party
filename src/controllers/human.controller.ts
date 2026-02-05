import readline from "node:readline/promises";
import { ActionChoice, Player, Turn, TurnAction } from "../types";
import { PlayerController, AskResult, ReactionResult, AccusationResult, AccusationVoteResult, DefenseResult } from "./player.controller";

export class HumanController implements PlayerController {
    constructor(private rl: ReturnType<typeof readline.createInterface>) {}

    async chooseAction(players: Player[], turns: Turn[], self: Player, canAccuse: boolean): Promise<ActionChoice> {
        const isSpy = self.secret.kind === "SPY";
        
        console.log("\n🎯 Your turn! Choose an action:");
        console.log("  [Q] Ask a question");
        if (isSpy) console.log("  [G] Guess the location (risky!)");
        if (canAccuse) console.log("  [A] Accuse someone of being the spy!");
        
        const input = await this.rl.question("Your choice (Q/G/A): ");
        const choice = input.trim().toUpperCase();
        
        let action: TurnAction = "question";
        if (choice === "G" && isSpy) {
            action = "guess";
        } else if (choice === "A" && canAccuse) {
            action = "vote"; // "vote" action type means "accuse"
        }
        
        return { action };
    }

    async ask(players: Player[], self: Player): Promise<AskResult> {
        const others = players.filter(p => p.id !== self.id).map(p => p.name);
        console.log(`\nIt is your turn to ask.`);
        const targetName = await this.rl.question(`Choose a target (${others.join(", ")}): `);
        const question = await this.rl.question(`Your question: `);
        return { targetName, question };
    }

    async answer(askerName: string, question: string, _self: Player): Promise<string> {
        console.log(`\n❓ ${askerName} asked you: ${question}`);
        return await this.rl.question(`Your answer: `);
    }

    async guessLocation(_turns: Turn[], _self: Player, whenCaught = true): Promise<string | null> {
        if (whenCaught) {
            console.log("\n🚨 You've been caught! One last chance to guess the location.");
        } else {
            console.log("\n🎲 You're taking a risk and guessing the location now!");
        }
        const guess = await this.rl.question("Your guess: ");
        return `GUESS: ${guess}\nREASON: Human intuition.`;
    }

    async vote(players: Player[], _turns: Turn[], self: Player): Promise<string> {
        const candidates = players.map(p => p.name).filter(n => n !== self.name);
        const vote = await this.rl.question(`\n🗳️ Vote for the SPY (${candidates.join(", ")}): `);
        return `VOTE: ${vote}`;
    }

    async accuse(players: Player[], _turns: Turn[], self: Player): Promise<AccusationResult> {
        const candidates = players.map(p => p.name).filter(n => n !== self.name);
        console.log(`\n🚨 You're making an accusation!`);
        const targetName = await this.rl.question(`Who do you accuse? (${candidates.join(", ")}): `);
        const reason = await this.rl.question(`Why? (public statement): `);
        return { targetName, reason };
    }

    async defendAgainstAccusation(accuserName: string, accusation: string, _turns: Turn[], _self: Player): Promise<DefenseResult> {
        console.log(`\n🚨 ${accuserName} accuses you of being the spy!`);
        console.log(`Their reason: "${accusation}"`);
        const defense = await this.rl.question(`Make your case! Your defense: `);
        return { defense };
    }

    async voteOnAccusation(accuserName: string, accusedName: string, defense: string, _turns: Turn[], _self: Player): Promise<AccusationVoteResult> {
        console.log(`\n⚖️ ${accuserName} accuses ${accusedName} of being the spy!`);
        console.log(`${accusedName}'s defense: "${defense}"`);
        const input = await this.rl.question(`Do you agree with the accusation? (Y/N): `);
        const vote = input.trim().toUpperCase().startsWith("Y") ? "yes" : "no";
        const reason = await this.rl.question(`Why? (public): `);
        return { vote, reason };
    }

    async react(_eventType: "question" | "answer", _authorName: string, _content: string, _self: Player): Promise<ReactionResult> {
        // Humans don't auto-react; skip
        return { emoji: "", reaction: "", suspicion: "" };
    }
}