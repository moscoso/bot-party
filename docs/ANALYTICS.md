# Analytics System

The analytics system tracks comprehensive game statistics, player performance, and location difficulty across all games played.

## Table of Contents

- [Overview](#overview)
- [Data Models](#data-models)
- [Analytics Service](#analytics-service)
- [Storage](#storage)
- [API Usage](#api-usage)
- [Dashboard](#dashboard)

## Overview

The analytics system automatically records:
- Game outcomes (winner, duration, turns)
- Player performance by AI provider
- Location play rates and win statistics
- Turn-by-turn game history
- Vote patterns and accusations

All data is stored as JSON files for portability and easy inspection.

## Data Models

### GameRecord

Complete record of a single game.

```typescript
interface GameRecord {
  gameId: string;              // Unique identifier (game-{timestamp})
  startTime: string;           // ISO 8601 datetime
  endTime: string;             // ISO 8601 datetime
  duration: number;            // Duration in seconds
  location: string;            // Location name
  winner: "spy" | "civilians" | "none";
  
  players: Array<{
    name: string;
    role: string;
    isSpy: boolean;
    isHuman: boolean;
    provider?: string;         // AI provider (if not human)
    mode?: "memory" | "stateless";
  }>;
  
  turns: TurnRecord[];
  votes: VoteRecord[];
  accusations: AccusationRecord[];
}
```

### TurnRecord

Record of a single question-and-answer turn.

```typescript
interface TurnRecord {
  turnNumber: number;
  questioner: string;          // Player name
  target: string;              // Target player name
  question: string;
  answer: string;
  timestamp?: string;          // ISO 8601 datetime
}
```

### VoteRecord

Record of a single vote.

```typescript
interface VoteRecord {
  voter: string;               // Player name
  votedFor: string;            // Voted player name
  timestamp?: string;          // ISO 8601 datetime
}
```

### AccusationRecord

Record of an early accusation.

```typescript
interface AccusationRecord {
  accuser: string;             // Player name
  accused: string;             // Accused player name
  turnNumber: number;
  isCorrect: boolean;
  timestamp?: string;          // ISO 8601 datetime
}
```

### AnalyticsSummary

Aggregated statistics across all games.

```typescript
interface AnalyticsSummary {
  totalGames: number;
  averageGameDuration: number;     // In seconds
  averageTurns: number;
  
  winsByRole: {
    spy: number;
    civilian: number;
  };
  
  providerStats: {
    [provider: string]: ProviderStats;
  };
  
  locationStats: {
    [location: string]: LocationStats;
  };
}
```

### ProviderStats

Performance statistics for an AI provider.

```typescript
interface ProviderStats {
  totalGames: number;          // Games where provider participated
  wins: number;                // Games where provider won
  spyWins: number;             // Wins as spy
  civilianWins: number;        // Wins as civilian
}
```

### LocationStats

Statistics for a specific location.

```typescript
interface LocationStats {
  timesPlayed: number;
  spyWins: number;
  civilianWins: number;
}
```

## Analytics Service

The `AnalyticsService` class handles all analytics operations.

### Location

```typescript
import { AnalyticsService } from "./analytics";
```

### Usage Example

```typescript
const analytics = new AnalyticsService();

// Start tracking a new game
const gameId = analytics.startGame(location, players);

// Record a turn
analytics.recordTurn(gameId, {
  turnNumber: 1,
  questioner: "Player 1",
  target: "Player 2",
  question: "What do you do here?",
  answer: "I manage the operations"
});

// Record votes
analytics.recordVotes(gameId, [
  { voter: "Player 1", votedFor: "Player 3" },
  { voter: "Player 2", votedFor: "Player 3" },
  { voter: "Player 3", votedFor: "Player 2" }
]);

// Record an early accusation
analytics.recordAccusation(gameId, {
  accuser: "Player 1",
  accused: "Player 2",
  turnNumber: 3,
  isCorrect: true
});

// End the game
analytics.endGame(gameId, winner);

// Get summary statistics
const summary = analytics.generateSummary();
console.log(`Total games: ${summary.totalGames}`);
console.log(`Spy win rate: ${summary.winsByRole.spy / summary.totalGames * 100}%`);
```

### Methods

#### `startGame(location, players)`

Start tracking a new game.

**Parameters:**
- `location` (string) - Location name
- `players` (Player[]) - Array of player objects

**Returns:** `string` - Unique game ID

#### `recordTurn(gameId, turn)`

Record a question-and-answer turn.

**Parameters:**
- `gameId` (string) - Game identifier
- `turn` (TurnRecord) - Turn details

#### `recordVotes(gameId, votes)`

Record all votes from the voting phase.

**Parameters:**
- `gameId` (string) - Game identifier
- `votes` (VoteRecord[]) - Array of vote records

#### `recordAccusation(gameId, accusation)`

Record an early accusation.

**Parameters:**
- `gameId` (string) - Game identifier
- `accusation` (AccusationRecord) - Accusation details

#### `endGame(gameId, winner)`

Finalize game and save to disk.

**Parameters:**
- `gameId` (string) - Game identifier
- `winner` ("spy" | "civilians" | "none") - Game outcome

#### `loadAllGames()`

Load all game records from disk.

**Returns:** `GameRecord[]` - Array of all games

#### `loadGame(gameId)`

Load a specific game record.

**Parameters:**
- `gameId` (string) - Game identifier

**Returns:** `GameRecord | null` - Game record or null if not found

#### `generateSummary()`

Generate aggregated statistics.

**Returns:** `AnalyticsSummary` - Summary statistics

## Storage

### File Location

Game records are stored in JSON format:

```
data/
└── games/
    ├── game-1738876543210.json
    ├── game-1738876544321.json
    └── game-1738876545432.json
```

### File Format

Each game is stored as a single JSON file:

```json
{
  "gameId": "game-1738876543210",
  "startTime": "2026-02-06T15:30:00.000Z",
  "endTime": "2026-02-06T15:35:20.000Z",
  "duration": 320,
  "location": "Airplane",
  "winner": "spy",
  "players": [
    {
      "name": "Player 1",
      "role": "Pilot",
      "isSpy": false,
      "isHuman": false,
      "provider": "openai",
      "mode": "memory"
    }
  ],
  "turns": [],
  "votes": [],
  "accusations": []
}
```

### Data Portability

Since data is stored as JSON files:
- Easy to backup (copy `data/games/` folder)
- Easy to transfer between systems
- Human-readable for debugging
- Can be version controlled (if desired)
- No database setup required

## API Usage

### Get Summary Statistics

```bash
curl http://localhost:3000/api/analytics/summary
```

### List All Games

```bash
curl http://localhost:3000/api/analytics/games
```

### Get Specific Game

```bash
curl http://localhost:3000/api/analytics/games/game-1738876543210
```

See [API.md](./API.md) for complete API documentation.

## Dashboard

### Accessing the Dashboard

Click the **📊 Analytics** button in the header or navigate to:

```
http://localhost:3000
```

Then click "Analytics" in the top navigation.

### Dashboard Sections

**Overview Card:**
- Total games played
- Average game duration (minutes)
- Average turns per game

**Win Rates by Role:**
- Spy wins (count and percentage)
- Civilian wins (count and percentage)

**AI Provider Performance:**
- Games played by each provider
- Win counts and percentages
- Breakdown by role (spy vs civilian)

**Top Locations:**
- Most played locations
- Play count for each

**Recent Games:**
- Last 10 games with details
- Location, winner, duration, turns
- Click to view details (future feature)

### Example Analytics Display

```
📊 Game Analytics

Overview                     Win Rates by Role
─────────────────           ─────────────────────
Total Games: 42             Spy Wins: 18 (42.9%)
Avg. Duration: 5m           Civilian Wins: 24 (57.1%)
Avg. Turns: 8.5

AI Provider Performance      Top Locations
───────────────────────      ─────────────────
openai: 28/42 (66.7%)       Airplane: 5 games
anthropic: 22/38 (57.9%)    Casino: 4 games
google: 20/35 (57.1%)       Hospital: 4 games
                            Bank: 3 games
                            Restaurant: 3 games

Recent Games
────────────────────────────────────────────────
game-17388765 | Feb 6, 2026 3:30 PM
📍 Airplane | 🏆 🕵️ Spy | ⏱️ 5m | 🔄 9 turns

game-17388764 | Feb 6, 2026 3:15 PM
📍 Casino | 🏆 👥 Civilians | ⏱️ 4m | 🔄 7 turns
```

## Performance Considerations

### File I/O

- Games are written individually (one file per game)
- Summary generation requires reading all game files
- For large datasets (1000+ games), consider:
  - Caching summary statistics
  - Pagination for game lists
  - Database migration (SQLite, PostgreSQL)

### Memory Usage

- All games are loaded into memory for summary generation
- Approximately 10-20 KB per game record
- 1000 games ≈ 10-20 MB memory usage
- Safe for most scenarios

### Optimization Tips

For production with many games:

1. **Add caching:**
   ```typescript
   let cachedSummary: AnalyticsSummary | null = null;
   let cacheTime = 0;
   
   function getCachedSummary() {
     if (!cachedSummary || Date.now() - cacheTime > 60000) {
       cachedSummary = analytics.generateSummary();
       cacheTime = Date.now();
     }
     return cachedSummary;
   }
   ```

2. **Pagination:**
   ```typescript
   function getRecentGames(page = 1, pageSize = 10) {
     const games = analytics.loadAllGames();
     const start = (page - 1) * pageSize;
     return games.slice(start, start + pageSize);
   }
   ```

3. **Aggregate on write:**
   Update summary stats when games end instead of recalculating.

## Future Enhancements

Potential improvements to the analytics system:

1. **Player-specific statistics** - Individual player performance tracking
2. **Time-series analysis** - Win rates over time
3. **Heatmaps** - Question patterns and player interactions
4. **Replay system** - Step through games turn-by-turn
5. **Export functionality** - CSV/Excel export for external analysis
6. **Comparative analysis** - Compare providers, modes, or locations
7. **Advanced metrics** - Entropy, information gain, deduction efficiency
8. **Database backend** - PostgreSQL/SQLite for larger datasets

## Troubleshooting

### Games not appearing in dashboard

1. Verify games are being saved:
   ```bash
   ls data/games/
   ```

2. Check file permissions:
   ```bash
   chmod 755 data/games/
   ```

3. Verify JSON format:
   ```bash
   cat data/games/game-*.json | jq
   ```

### Incorrect statistics

1. Regenerate summary (no caching by default)
2. Check for corrupted game files
3. Verify game records have all required fields

### Performance issues

1. Check number of game files:
   ```bash
   ls data/games/ | wc -l
   ```

2. Implement caching if > 1000 games
3. Consider database migration
