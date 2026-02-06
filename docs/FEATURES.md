# AI Personalities & Game Features

Bot Party includes AI personality system and quality-of-life improvements to enhance gameplay variety and experience.

## AI Personalities

### Overview

Each AI agent can be assigned a personality that affects how they play the game. Personalities influence:

- **Questioning style** - How they ask questions (aggressive, cautious, creative)
- **Answering approach** - How they respond (brief, verbose, defensive)
- **Suspicion behavior** - How they react to other players (paranoid, trusting)
- **Decision-making** - How they make accusations and votes (bold, methodical)

### Available Personalities

#### Neutral (Default)
- **Style:** Balanced gameplay
- **Best for:** Standard games, learning the system
- **Characteristics:** No special behavioral traits, general strategy

#### Aggressive
- **Style:** Direct and confrontational
- **Best for:** High-pressure gameplay, quick games
- **Characteristics:**
  - Asks pointed, direct questions
  - Puts pressure on suspicious players
  - Quick to accuse and make bold decisions
  - Voices suspicions openly

#### Quiet Observer
- **Style:** Reserved and cautious
- **Best for:** Strategic gameplay, defensive play
- **Characteristics:**
  - Brief, minimal responses
  - Watches and listens more than speaks
  - Avoids drawing attention
  - Waits for clear evidence before acting

#### Paranoid
- **Style:** Suspects everyone
- **Best for:** Chaotic gameplay, comedy
- **Characteristics:**
  - Questions everything and everyone
  - Sees conspiracies and hidden meanings
  - Over-explains defensive answers
  - Changes mind frequently

#### Comedic (Class Clown)
- **Style:** Playful and humorous
- **Best for:** Entertainment, casual games
- **Characteristics:**
  - Makes jokes and puns
  - Uses humor to deflect or gather info
  - Dramatic decision-making
  - Keeps mood light

#### Analytical (Detective)
- **Style:** Logical and methodical
- **Best for:** Serious gameplay, pattern recognition
- **Characteristics:**
  - Asks systematic, logical questions
  - Tracks contradictions and patterns
  - Explains reasoning clearly
  - Evidence-based decisions

#### Social Butterfly
- **Style:** Friendly and trusting
- **Best for:** Cooperative gameplay, relationship focus
- **Characteristics:**
  - Warm and conversational
  - Builds rapport with players
  - Slow to suspect, gives benefit of doubt
  - Relationship-driven decisions

### Using Personalities

#### In UI

1. Configure players in game setup
2. For each AI player, select a personality from the dropdown
3. Mix and match personalities for dynamic interactions
4. Human players don't have personalities

#### In API

Include personality as third parameter in player config:

```bash
# Format: provider:mode:personality
curl "http://localhost:3000/api/start?players=openai:memory:aggressive,anthropic:memory:quiet,google:stateful:analytical"
```

Personality is optional and defaults to `neutral` if not specified:

```bash
# These are equivalent:
players=openai:memory
players=openai:memory:neutral
```

### Personality Combinations

Experiment with different combinations for unique gameplay:

**Intense Investigation:**
- Multiple `aggressive` and `analytical` players
- Fast-paced questioning and accusations

**Chaos Mode:**
- Mix of `paranoid` and `comedic` players  
- Unpredictable, entertaining gameplay

**Strategic Depth:**
- Combination of `analytical`, `quiet`, and `social` players
- Methodical, relationship-based play

**Comedy Show:**
- Multiple `comedic` and `paranoid` players
- Maximum entertainment value

## Reaction Frequency

Control how often AI agents react to questions and answers from other players.

### Options

| Setting | Probability | Description |
|---------|------------|-------------|
| `always` | 100% | Every eligible player reacts to every Q&A |
| `frequent` | 75% | Most players react most of the time |
| `sometimes` | 50% | About half of eligible players react (default) |
| `rare` | 25% | Occasional reactions |
| `never` | 0% | No reactions, only Q&A |

### Usage

**In UI:**
Select "AI Reaction Frequency" dropdown in game setup.

**In API:**
```bash
curl "http://localhost:3000/api/start?reactionFrequency=sometimes&..."
```

### When to Adjust

- **Always/Frequent:** More interactive, longer games
- **Sometimes (default):** Balanced gameplay
- **Rare/Never:** Faster games, reduce output

## Enhanced Location Display

### Categorized Locations

Locations are now organized by category for better readability:

- **Travel & Transport:** Airplane, Ocean Liner, Submarine, etc.
- **Entertainment & Leisure:** Casino, Beach, Theatre, Zoo, etc.
- **Work & Business:** Bank, Hotel, University, etc.
- **Public Services:** Hospital, Police Station, School, etc.
- **Special:** Crusader Army, Polar Station, Space Station

### Role Hints

Civilian players now receive hints about other possible roles at their location:

```
📍 LOCATION: Hospital
👤 YOUR ROLE: Nurse
💡 OTHER ROLES AT Hospital: Physician, Surgeon, Patient, Intern...
```

**Benefits:**
- Helps civilians understand their location context
- Makes role-playing more natural
- Reduces confusion about what roles exist

## API Key Validation

### Error Messages

When API keys are missing or invalid, the system provides helpful error messages:

```
Missing API key for openai.
Please set OPENAI_API_KEY in your .env file.
Get your API key at: https://platform.openai.com/api-keys
```

### Health Check

Use `/api/health` endpoint to check provider configuration:

```bash
curl http://localhost:3000/api/health
```

Response shows which providers are properly configured:

```json
{
  "ok": true,
  "availableProviders": ["openai", "anthropic"],
  "providerStatus": {
    "openai": { "configured": true, "displayName": "GPT" },
    "anthropic": { "configured": true, "displayName": "Claude" },
    "google": { "configured": false, "displayName": "Gemini" }
  }
}
```

### Provider-Specific Errors

Each provider throws descriptive errors with context:

```
openai API error (chat completion): Invalid API key
Check your API key and provider status.
```

## Tips & Best Practices

### Personality Selection

1. **Vary personalities** - Mix different types for interesting dynamics
2. **Match to role** - Aggressive spy vs. trusting civilian creates tension
3. **Consider game length** - More `quiet` players = faster games
4. **Experiment** - Try all combinations to find favorites

### Reaction Frequency

1. **Start with `sometimes`** (default) for balanced games
2. **Increase for drama** - More reactions = more interaction
3. **Decrease for speed** - Fewer reactions = faster completion
4. **Match to player count** - More players = lower frequency recommended

### API Keys

1. **Set all** three provider keys for maximum variety
2. **Test with `/api/health`** before starting games
3. **Check `.env` file** if providers fail to initialize
4. **Use different models** via environment variables (e.g., `OPENAI_MODEL=gpt-4o`)

### Location Hints

Utilize role hints to:
- Understand your location's theme
- Give answers that fit multiple roles
- Avoid being too specific as civilian
