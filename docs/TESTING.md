# Testing Guide

Bot Party uses [Vitest](https://vitest.dev/) as its testing framework, providing fast, modern testing with native TypeScript support.

## Table of Contents

- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Mock Providers](#mock-providers)
- [Test Utilities](#test-utilities)
- [Coverage](#coverage)

## Getting Started

### Prerequisites

Vitest is already configured in the project. No additional setup is required.

### Installation

Tests are included in the main dependencies:

```bash
npm install
```

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with interactive UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Vitest Commands

You can also use Vitest directly:

```bash
# Run specific test file
npx vitest src/utils/parseField.test.ts

# Run tests matching a pattern
npx vitest --grep "parseField"

# Run tests in a specific directory
npx vitest src/utils/

# Run with coverage
npx vitest --coverage
```

## Test Structure

Tests are organized alongside the source code with `.test.ts` extension:

```
src/
├── utils/
│   ├── parseField.ts
│   ├── parseField.test.ts      # Unit tests for parseField
│   ├── random.ts
│   └── random.test.ts          # Unit tests for random
├── phases/
│   ├── voting.ts
│   └── voting.test.ts          # Unit tests for voting
├── data.test.ts                # Tests for location data integrity
└── __tests__/                  # Test infrastructure
    ├── fixtures/
    │   └── index.ts            # Test data and fixtures
    ├── mocks/
    │   └── provider.mock.ts    # Mock AI provider
    └── helpers.ts              # Test utilities
```

## Writing Tests

### Basic Test

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./myFunction";

describe("myFunction", () => {
  it("should return expected value", () => {
    const result = myFunction("input");
    expect(result).toBe("expected");
  });

  it("should handle edge cases", () => {
    expect(myFunction("")).toBe("");
    expect(myFunction(null)).toBe(null);
  });
});
```

### Testing with Mock Provider

Use the `MockAIProvider` for testing code that depends on AI responses:

```typescript
import { describe, it, expect } from "vitest";
import { MockAIProvider } from "./__tests__/mocks/provider.mock";

describe("AI-dependent feature", () => {
  it("should process AI responses", async () => {
    const provider = new MockAIProvider();
    const response = await provider.ask("test prompt");
    
    expect(response).toContain("mockResponse");
  });
});
```

### Using Test Fixtures

Import pre-configured test data from fixtures:

```typescript
import { describe, it, expect } from "vitest";
import { 
  mockLocation, 
  mockPlayers, 
  mockGameConfig 
} from "./__tests__/fixtures";

describe("Game setup", () => {
  it("should initialize with mock data", () => {
    const game = new SpyfallGame(mockGameConfig);
    expect(game.location).toEqual(mockLocation);
  });
});
```

### Deterministic Random Tests

Use seeded random for reproducible tests:

```typescript
import { describe, it, expect } from "vitest";
import { createSeededRandom } from "./__tests__/helpers";

describe("Random selection", () => {
  it("should produce consistent results", () => {
    const random = createSeededRandom(42);
    const value1 = random.pickRandom([1, 2, 3, 4, 5]);
    
    // Reset with same seed
    const random2 = createSeededRandom(42);
    const value2 = random2.pickRandom([1, 2, 3, 4, 5]);
    
    expect(value1).toBe(value2);
  });
});
```

## Mock Providers

### MockAIProvider

A test double that simulates AI provider responses:

```typescript
import { MockAIProvider } from "./__tests__/mocks/provider.mock";

const provider = new MockAIProvider({
  responsePrefix: "custom-",
  delay: 100 // Simulate network delay
});

// Returns "custom-mockResponse-{counter}"
const response = await provider.ask("question");
```

**Features:**
- Deterministic responses with counter
- Configurable response prefix
- Optional delay simulation
- No actual API calls

### Creating Custom Mocks

```typescript
import { vi } from "vitest";
import type { AIProvider } from "../providers/types";

const mockProvider: AIProvider = {
  ask: vi.fn().mockResolvedValue("mocked response"),
  close: vi.fn()
};

// Use in tests
it("should call provider", async () => {
  await someFunction(mockProvider);
  expect(mockProvider.ask).toHaveBeenCalledWith("expected prompt");
});
```

## Test Utilities

### Available Helpers

Located in `src/__tests__/helpers.ts`:

```typescript
// Create seeded random for deterministic tests
const random = createSeededRandom(seed);

// Build test game config
const config = createTestGameConfig({
  rounds: 5,
  locationName: "Airplane"
});

// Create test player
const player = createTestPlayer({
  name: "Player 1",
  isSpy: true
});
```

### Custom Test Utilities

Add reusable test helpers to `helpers.ts`:

```typescript
export function createMockGame(overrides = {}) {
  return {
    location: mockLocation,
    players: mockPlayers,
    config: mockGameConfig,
    ...overrides
  };
}
```

## Coverage

### Generating Reports

```bash
# Generate coverage report
npm run test:coverage
```

Coverage reports are generated using `c8` (V8's native coverage):

```
---------|---------|---------|---------|---------|-------------------
File     | % Stmts | % Branch| % Funcs | % Lines | Uncovered Line #s 
---------|---------|---------|---------|---------|-------------------
All files|   85.23 |   78.45 |   82.11 |   85.67 |
 utils   |   92.34 |   88.12 |   95.00 |   92.50 |
  parseField.ts | 95.00 | 90.00 | 100.00 | 95.00 | 42-43
---------|---------|---------|---------|---------|-------------------
```

### Coverage Configuration

Coverage settings in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/node_modules/**",
        "**/__tests__/**"
      ]
    }
  }
});
```

### Viewing HTML Reports

After running coverage, open the HTML report:

```bash
open coverage/index.html
```

## Best Practices

### 1. Test Organization

```typescript
describe("FeatureName", () => {
  describe("methodName", () => {
    it("should handle normal case", () => {
      // Test
    });

    it("should handle edge case", () => {
      // Test
    });

    it("should throw on invalid input", () => {
      // Test
    });
  });
});
```

### 2. Descriptive Test Names

✅ Good:
```typescript
it("should return empty string when field is not found")
it("should normalize names to lowercase for comparison")
```

❌ Bad:
```typescript
it("works")
it("test parseField")
```

### 3. Arrange-Act-Assert Pattern

```typescript
it("should calculate total correctly", () => {
  // Arrange
  const items = [1, 2, 3, 4, 5];
  
  // Act
  const total = calculateTotal(items);
  
  // Assert
  expect(total).toBe(15);
});
```

### 4. Test One Thing

✅ Good:
```typescript
it("should add player to list", () => {
  game.addPlayer(player);
  expect(game.players).toContain(player);
});

it("should increment player count", () => {
  const before = game.playerCount;
  game.addPlayer(player);
  expect(game.playerCount).toBe(before + 1);
});
```

❌ Bad:
```typescript
it("should add player and increment count and validate player", () => {
  // Testing too many things
});
```

### 5. Avoid Test Interdependence

Each test should be independent and able to run in any order:

```typescript
// ❌ Bad - tests depend on each other
let sharedState;

it("test 1", () => {
  sharedState = "value";
});

it("test 2", () => {
  expect(sharedState).toBe("value"); // Depends on test 1
});

// ✅ Good - independent tests
it("test 1", () => {
  const state = "value";
  expect(state).toBe("value");
});

it("test 2", () => {
  const state = "value";
  expect(state).toBe("value");
});
```

## Current Test Suite

### Test Statistics

- **Total Tests**: 43
- **Test Files**: 7
- **Coverage**: ~85% (utilities and core logic)

### Test Files

1. `parseField.test.ts` (9 tests) - AI response parsing
2. `normalizeName.test.ts` (4 tests) - Name normalization
3. `resolveTargetPlayer.test.ts` (8 tests) - Player resolution with fuzzy matching
4. `random.test.ts` (10 tests) - Random utilities with seeding
5. `data.test.ts` (7 tests) - Location data validation
6. `voting.test.ts` (5 tests) - Vote tallying and tie detection

### Running Specific Suites

```bash
# Run only utility tests
npm test -- src/utils/

# Run only game logic tests
npm test -- src/phases/

# Run data validation
npm test -- src/data.test.ts
```

## Debugging Tests

### Using Vitest UI

```bash
npm run test:ui
```

Opens an interactive interface for:
- Running individual tests
- Viewing test output
- Time travel debugging
- Coverage visualization

### Console Logging

```typescript
it("should debug values", () => {
  const value = someFunction();
  console.log("Debug value:", value); // Visible in test output
  expect(value).toBe("expected");
});
```

### Breakpoints

Run tests in debug mode:

```bash
node --inspect-brk node_modules/.bin/vitest --run
```

Then attach your debugger (VS Code, Chrome DevTools).

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Troubleshooting

### Tests Failing Intermittently

Use seeded random for deterministic behavior:

```typescript
import { createSeededRandom } from "./__tests__/helpers";
const random = createSeededRandom(42);
```

### TypeScript Errors in Tests

Ensure test files are included in `tsconfig.json`:

```json
{
  "include": ["src/**/*.ts", "src/**/*.test.ts"]
}
```

### Import Errors

Use proper file extensions for ES modules:

```typescript
import { myFunction } from "./myFunction.js"; // Note .js extension
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Testing Best Practices](https://testingjavascript.com/)
