# Location Management

The location management system allows you to use default locations or import custom location packs for variety and replayability.

## Table of Contents

- [Overview](#overview)
- [Default Locations](#default-locations)
- [Custom Locations](#custom-locations)
- [Location Pack Format](#location-pack-format)
- [Import/Export](#importexport)
- [Validation](#validation)
- [API Usage](#api-usage)

## Overview

Locations are the settings where Spyfall games take place. Each location includes:
- A unique name (e.g., "Airplane", "Casino")
- A list of roles (7-8 roles per location)
- One role is assigned to each civilian player
- The spy doesn't know the location or get a role

## Default Locations

Bot Party includes **30 default locations**:

1. Airplane
2. Bank
3. Beach
4. Broadway Theater
5. Casino
6. Cathedral
7. Circus Tent
8. Corporate Party
9. Crusader Army
10. Day Spa
11. Embassy
12. Hospital
13. Hotel
14. Military Base
15. Movie Studio
16. Ocean Liner
17. Passenger Train
18. Pirate Ship
19. Polar Station
20. Police Station
21. Restaurant
22. School
23. Service Station
24. Space Station
25. Submarine
26. Supermarket
27. University
28. Amusement Park
29. Art Museum
30. Vineyard

### Example Location

**Airplane:**
- First Class Passenger
- Air Marshal
- Mechanic
- Economy Class Passenger
- Stewardess
- Co-Pilot
- Captain

**Casino:**
- Bartender
- Head Security Guard
- Bouncer
- Manager
- Hustler
- Dealer
- Gambler

## Custom Locations

You can create and import custom location packs to add variety, themes, or inside jokes to your games.

### Creating a Custom Location

Create a JSON file with this structure:

```json
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

### Creating Multiple Locations

Import multiple locations at once:

```json
[
  {
    "name": "Medieval Castle",
    "roles": [
      "King",
      "Queen",
      "Knight",
      "Jester",
      "Cook",
      "Blacksmith",
      "Guard"
    ]
  },
  {
    "name": "Tech Startup",
    "roles": [
      "CEO",
      "CTO",
      "Product Manager",
      "Software Engineer",
      "Designer",
      "Marketing Manager",
      "Intern"
    ]
  }
]
```

## Location Pack Format

### Single Location

```json
{
  "name": string,      // Location name (unique)
  "roles": string[]    // Array of role names (3-8 roles)
}
```

### Multiple Locations

```json
[
  {
    "name": string,
    "roles": string[]
  },
  ...
]
```

### Requirements

1. **Location name**: Non-empty string, will be validated for uniqueness
2. **Roles**: Array of 3-8 non-empty strings
3. **Unique roles**: No duplicate role names within a location
4. **Format**: Valid JSON

### Example Valid Locations

✅ **Minimum roles (3):**
```json
{
  "name": "Small Cafe",
  "roles": ["Barista", "Manager", "Customer"]
}
```

✅ **Standard roles (7):**
```json
{
  "name": "Library",
  "roles": [
    "Librarian",
    "Security Guard",
    "Student",
    "Professor",
    "Janitor",
    "IT Technician",
    "Archivist"
  ]
}
```

✅ **Maximum roles (8+):**
```json
{
  "name": "Large Hospital",
  "roles": [
    "Surgeon",
    "Nurse",
    "Anesthesiologist",
    "Radiologist",
    "Pharmacist",
    "Receptionist",
    "Janitor",
    "Security Guard"
  ]
}
```

### Example Invalid Locations

❌ **Too few roles:**
```json
{
  "name": "Invalid",
  "roles": ["Role 1", "Role 2"]  // Need at least 3
}
```

❌ **Duplicate roles:**
```json
{
  "name": "Invalid",
  "roles": ["Doctor", "Nurse", "Doctor"]  // Duplicate "Doctor"
}
```

❌ **Empty role name:**
```json
{
  "name": "Invalid",
  "roles": ["Doctor", "", "Nurse"]  // Empty string
}
```

❌ **No name:**
```json
{
  "name": "",
  "roles": ["Role 1", "Role 2", "Role 3"]
}
```

## Import/Export

### Import via UI

1. Click "Import Locations" button
2. Select a JSON file from your computer
3. System validates and imports
4. Success message shows total location count
5. Imported locations appear in dropdown

### Export via UI

1. Click "Export All" button
2. Downloads `locations.json` containing all locations
3. File includes both default and custom locations
4. Can be shared with others or backed up

### Import via API

```bash
# Single location
curl -X POST http://localhost:3000/api/locations/import \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Space Station",
    "roles": ["Commander", "Engineer", "Scientist", "Doctor", "Security", "Comms", "Maintenance"]
  }'

# Multiple locations from file
curl -X POST http://localhost:3000/api/locations/import \
  -H "Content-Type: application/json" \
  -d @my-locations.json
```

### Export via API

```bash
# Download all locations
curl http://localhost:3000/api/locations/export -o locations.json

# View in terminal
curl http://localhost:3000/api/locations/export | jq
```

## Validation

The `LocationManager` class validates all imported locations.

### Validation Rules

1. **Location name must be non-empty**
   ```
   Error: Location name cannot be empty
   ```

2. **Minimum 3 roles required**
   ```
   Error: Location must have at least 3 roles
   ```

3. **All roles must be unique**
   ```
   Error: Duplicate role found: "Doctor"
   ```

4. **All role names must be non-empty**
   ```
   Error: Role names cannot be empty
   ```

5. **Must be valid JSON**
   ```
   Error: Invalid JSON format
   ```

### Validation Example

```typescript
import { LocationManager } from "./locations";

const manager = new LocationManager();

try {
  manager.addCustom({
    name: "Test Location",
    roles: ["Role 1", "Role 2", "Role 3"]
  });
  console.log("Location added successfully");
} catch (error) {
  console.error("Validation failed:", error.message);
}
```

## API Usage

### Get All Locations

```bash
curl http://localhost:3000/api/locations
```

Returns array of all locations (default + custom).

### Get Location Count

```bash
curl http://localhost:3000/api/locations/count
```

Returns:
```json
{
  "total": 32,
  "default": 30,
  "custom": 2
}
```

### Import Location

```bash
curl -X POST http://localhost:3000/api/locations/import \
  -H "Content-Type: application/json" \
  -d @location.json
```

Success response:
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

Error response:
```json
{
  "error": "Location must have at least 3 roles"
}
```

### Export Locations

```bash
curl http://localhost:3000/api/locations/export > locations.json
```

### Select Location for Game

When starting a game, specify a location:

```bash
curl "http://localhost:3000/api/start?location=Space%20Station&rounds=9&players=openai:memory,anthropic:memory"
```

Or use random (default):

```bash
curl "http://localhost:3000/api/start?rounds=9&players=openai:memory,anthropic:memory"
```

## Location Manager

### Usage in Code

```typescript
import { LocationManager } from "./locations";

const manager = new LocationManager();

// Get all locations
const all = manager.getAll();

// Get only defaults
const defaults = manager.getDefaults();

// Get only custom
const custom = manager.getCustom();

// Add single custom location
manager.addCustom({
  name: "New Location",
  roles: ["Role 1", "Role 2", "Role 3"]
});

// Add multiple custom locations
manager.addCustomBatch([
  { name: "Location 1", roles: [...] },
  { name: "Location 2", roles: [...] }
]);

// Find by name (case-insensitive)
const location = manager.findByName("airplane");

// Get counts
const count = manager.getCount();
// { total: 32, default: 30, custom: 2 }

// Export all
const json = manager.exportAll();

// Validate location
const isValid = manager.validateLocation({
  name: "Test",
  roles: ["A", "B", "C"]
});
```

## Best Practices

### Naming Locations

✅ Good names:
- "Space Station"
- "Medieval Castle"
- "Tech Startup Office"
- "Underwater Research Lab"

❌ Avoid:
- Generic names: "Location 1", "Test"
- Too specific: "Bob's Apartment"
- Duplicate existing names

### Choosing Roles

✅ Good roles:
- Distinct and memorable
- Related to the location
- Easy to ask questions about
- Variety in status/function

Example for "Hospital":
- Surgeon (high status)
- Nurse (medical)
- Janitor (support)
- Security Guard (different function)
- Patient (customer)
- Administrator (management)
- Pharmacist (specialized)

❌ Avoid:
- Too similar: "Doctor 1", "Doctor 2"
- Too generic: "Person", "Worker"
- Ambiguous: "Helper"

### Testing Locations

Before sharing custom locations:

1. Test with AI players to ensure roles are distinct
2. Verify questions can meaningfully differentiate roles
3. Check that location isn't too obvious or too obscure
4. Ensure roles have different perspectives/knowledge

## Sharing Location Packs

### Community Packs

Create themed packs to share:

**Tech Pack:**
- Tech Startup
- Data Center
- Gaming Studio
- Cryptocurrency Exchange

**Fantasy Pack:**
- Medieval Castle
- Dragon's Lair
- Wizard's Tower
- Enchanted Forest

**Seasonal Pack:**
- Christmas Workshop
- Halloween Haunted House
- Summer Camp
- Thanksgiving Dinner

### Distribution

1. Export your custom locations
2. Share JSON file via:
   - GitHub repositories
   - Discord/forums
   - Personal website
   - Package as downloadable pack

### Credits

Include credits in your pack:

```json
[
  {
    "_info": {
      "name": "Tech Pack v1.0",
      "author": "Your Name",
      "description": "Modern tech workplace locations"
    },
    "locations": [...]
  }
]
```

## Troubleshooting

### Import fails

1. **Check JSON format**: Use a JSON validator
2. **Verify file encoding**: Should be UTF-8
3. **Check validation rules**: Review error message
4. **Test with single location**: Narrow down issues

### Location not appearing in dropdown

1. Refresh the page
2. Check import success message
3. Verify `/api/locations/count` shows increased count
4. Check browser console for errors

### Roles too similar

If AI agents can't distinguish roles:
- Add more specific details to role names
- Create roles with different functions
- Test with different question patterns

### Game too easy/hard

Adjust based on experience:
- **Too easy for civilians**: More ambiguous roles
- **Too easy for spy**: More distinct roles
- **Too hard**: Ensure roles relate to location

## Future Features

Planned enhancements:

1. **Location difficulty ratings** - Based on win rates
2. **Role descriptions** - Additional context for each role
3. **Location categories** - Filter by theme/difficulty
4. **Randomizer options** - Weighted random selection
5. **Location voting** - Players vote on location pool
6. **Location history** - Track recently played locations
7. **Custom role pools** - Assign role subsets per game
