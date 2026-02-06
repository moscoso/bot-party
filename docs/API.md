# API Reference

Bot Party provides a REST API for game management, analytics, and location handling.

## Base URL

```
http://localhost:3000
```

## Endpoints

### Game Management

#### Start Game

```http
POST /api/start?rounds=9&players=openai:memory,anthropic:memory&location=Airplane
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `rounds` | number | Yes | Number of question rounds (1-30) |
| `players` | string | Yes | Comma-separated list of player configs |
| `location` | string | No | Specific location name (default: random) |
| `allowEarlyVote` | boolean | No | Allow early accusations (default: true) |

**Player Format:**
- AI players: `{provider}:{mode}` (e.g., `openai:memory`, `anthropic:stateless`)
- Human players: `human`

**Providers:**
- `openai` - OpenAI GPT models
- `anthropic` - Anthropic Claude models
- `google` - Google Gemini models

**Modes:**
- `memory` - Stateful agent (remembers previous turns)
- `stateless` - Independent turns

**Example:**
```bash
curl "http://localhost:3000/api/start?rounds=5&players=openai:memory,anthropic:memory,google:stateless,human"
```

**Response:**
- Server-Sent Events (SSE) stream
- Events: `log`, `prompt`, `gameinfo`, `agentcreated`

#### Stream Game Events

```http
GET /api/stream
```

Connect to receive real-time game events via Server-Sent Events.

**Event Types:**

**`log`** - Game log messages
```json
{
  "line": "🎬 Game starting..."
}
```

**`gameinfo`** - Game state updates
```json
{
  "type": "gameinfo",
  "location": "Airplane",
  "roles": [...],
  "spy": "Player 2",
  "humanSecret": "Pilot"
}
```

**`prompt`** - AI prompts and responses
```json
{
  "player": "Player 1",
  "provider": "openai",
  "mode": "memory",
  "prompt": "...",
  "response": "..."
}
```

**`agentcreated`** - Agent initialization
```json
{
  "player": "Player 1",
  "provider": "openai",
  "mode": "memory"
}
```

### Provider Information

#### Get Provider Capabilities

```http
GET /api/providers
```

Returns available AI providers and their capabilities.

**Response:**
```json
{
  "openai": {
    "displayName": "GPT",
    "supportsStateful": true
  },
  "anthropic": {
    "displayName": "Claude",
    "supportsStateful": false
  },
  "google": {
    "displayName": "Gemini",
    "supportsStateful": true
  }
}
```

### Analytics

#### Get Analytics Summary

```http
GET /api/analytics/summary
```

Returns aggregated statistics across all games.

**Response:**
```json
{
  "totalGames": 42,
  "averageGameDuration": 320,
  "averageTurns": 8.5,
  "winsByRole": {
    "spy": 18,
    "civilian": 24
  },
  "providerStats": {
    "openai": {
      "totalGames": 42,
      "wins": 28,
      "spyWins": 12,
      "civilianWins": 16
    },
    "anthropic": {
      "totalGames": 38,
      "wins": 22,
      "spyWins": 8,
      "civilianWins": 14
    },
    "google": {
      "totalGames": 35,
      "wins": 20,
      "spyWins": 7,
      "civilianWins": 13
    }
  },
  "locationStats": {
    "Airplane": {
      "timesPlayed": 5,
      "spyWins": 2,
      "civilianWins": 3
    },
    "Casino": {
      "timesPlayed": 4,
      "spyWins": 1,
      "civilianWins": 3
    }
  }
}
```

**Fields:**
- `totalGames` - Total number of games played
- `averageGameDuration` - Average game time in seconds
- `averageTurns` - Average number of turns per game
- `winsByRole` - Win counts for spy vs civilians
- `providerStats` - Performance by AI provider
- `locationStats` - Statistics by location

#### Get All Games

```http
GET /api/analytics/games
```

Returns metadata for all recorded games.

**Response:**
```json
[
  {
    "gameId": "game-1738876543210",
    "startTime": "2026-02-06T15:30:00Z",
    "endTime": "2026-02-06T15:35:20Z",
    "duration": 320,
    "location": "Airplane",
    "winner": "spy",
    "turns": 9,
    "players": 4
  }
]
```

#### Get Game Details

```http
GET /api/analytics/games/:gameId
```

Returns complete details for a specific game including all turns, votes, and accusations.

**Response:**
```json
{
  "gameId": "game-1738876543210",
  "startTime": "2026-02-06T15:30:00Z",
  "endTime": "2026-02-06T15:35:20Z",
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
  "turns": [
    {
      "turnNumber": 1,
      "questioner": "Player 1",
      "target": "Player 2",
      "question": "What's your favorite part of your job?",
      "answer": "The view from up here is amazing"
    }
  ],
  "votes": [
    {
      "voter": "Player 1",
      "votedFor": "Player 2"
    }
  ],
  "accusations": []
}
```

### Locations

#### Get All Locations

```http
GET /api/locations
```

Returns all available locations (default + custom).

**Response:**
```json
[
  {
    "name": "Airplane",
    "roles": [
      "First Class Passenger",
      "Air Marshal",
      "Mechanic",
      "Economy Class Passenger",
      "Stewardess",
      "Co-Pilot",
      "Captain"
    ]
  },
  {
    "name": "Casino",
    "roles": [
      "Bartender",
      "Head Security Guard",
      "Bouncer",
      "Manager",
      "Hustler",
      "Dealer",
      "Gambler"
    ]
  }
]
```

#### Get Location Count

```http
GET /api/locations/count
```

Returns counts of default and custom locations.

**Response:**
```json
{
  "total": 32,
  "default": 30,
  "custom": 2
}
```

#### Import Custom Locations

```http
POST /api/locations/import
Content-Type: application/json

{
  "name": "Space Station",
  "roles": [
    "Commander",
    "Engineer",
    "Scientist",
    "Doctor",
    "Security Officer",
    "Communications Officer",
    "Maintenance Crew"
  ]
}
```

Or import multiple locations:

```json
[
  {
    "name": "Space Station",
    "roles": ["Commander", "Engineer", ...]
  },
  {
    "name": "Submarine",
    "roles": ["Captain", "Sonar Operator", ...]
  }
]
```

**Validation Rules:**
- Location name must be non-empty string
- Minimum 3 roles required
- All role names must be unique
- All role names must be non-empty strings

**Response:**
```json
{
  "success": true,
  "count": {
    "total": 31,
    "default": 30,
    "custom": 1
  }
}
```

**Error Response:**
```json
{
  "error": "Location must have at least 3 roles"
}
```

#### Export All Locations

```http
GET /api/locations/export
```

Downloads a JSON file containing all locations (default + custom).

**Response:**
- `Content-Type: application/json`
- `Content-Disposition: attachment; filename="locations.json"`

```json
[
  {
    "name": "Airplane",
    "roles": [...]
  },
  ...
]
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200 OK` - Success
- `400 Bad Request` - Invalid parameters or validation error
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error response format:
```json
{
  "error": "Error message description"
}
```

## Rate Limiting

Currently no rate limiting is enforced. For production deployments, consider implementing rate limiting on the API endpoints.

## CORS

The API currently does not set CORS headers. The web UI must be served from the same origin as the API.

## Authentication

The API currently does not require authentication. AI provider API keys are managed server-side via environment variables.
