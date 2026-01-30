import { SpyfallGame } from "./game";

const game = new SpyfallGame();
console.log("Starting Spyfall...");

await game.run({
    numPlayers: 3,       // total players
    includeHuman: false,  // set false for AI-only
    rounds: 9            // number of Q/A turns
});