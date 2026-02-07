import { describe, it, expect } from "vitest";
import {
    Personality,
    NEUTRAL_PERSONALITY,
    AGGRESSIVE_PERSONALITY,
    QUIET_PERSONALITY,
    PARANOID_PERSONALITY,
    COMEDIC_PERSONALITY,
    ANALYTICAL_PERSONALITY,
    SOCIAL_PERSONALITY,
    ALL_PERSONALITIES,
    getPersonalityById,
    getRandomPersonality,
    applyPersonalityToPrompt,
} from "./personalities";

describe("Personality System", () => {
    describe("Personality Definitions", () => {
        it("should have 7 total personalities", () => {
            expect(ALL_PERSONALITIES).toHaveLength(7);
        });

        it("should have all required properties for each personality", () => {
            ALL_PERSONALITIES.forEach(personality => {
                expect(personality).toHaveProperty("id");
                expect(personality).toHaveProperty("name");
                expect(personality).toHaveProperty("description");
                expect(personality).toHaveProperty("traits");
                
                expect(personality.traits).toHaveProperty("style");
                expect(personality.traits).toHaveProperty("questioning");
                expect(personality.traits).toHaveProperty("answering");
                expect(personality.traits).toHaveProperty("suspicion");
                expect(personality.traits).toHaveProperty("decisions");
                
                expect(typeof personality.id).toBe("string");
                expect(typeof personality.name).toBe("string");
                expect(typeof personality.description).toBe("string");
                expect(personality.id.length).toBeGreaterThan(0);
                expect(personality.name.length).toBeGreaterThan(0);
            });
        });

        it("should have unique IDs", () => {
            const ids = ALL_PERSONALITIES.map(p => p.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ALL_PERSONALITIES.length);
        });

        it("should have unique names", () => {
            const names = ALL_PERSONALITIES.map(p => p.name);
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(ALL_PERSONALITIES.length);
        });

        it("should include neutral personality", () => {
            expect(ALL_PERSONALITIES).toContain(NEUTRAL_PERSONALITY);
        });

        it("should include all personality types", () => {
            expect(ALL_PERSONALITIES).toContain(NEUTRAL_PERSONALITY);
            expect(ALL_PERSONALITIES).toContain(AGGRESSIVE_PERSONALITY);
            expect(ALL_PERSONALITIES).toContain(QUIET_PERSONALITY);
            expect(ALL_PERSONALITIES).toContain(PARANOID_PERSONALITY);
            expect(ALL_PERSONALITIES).toContain(COMEDIC_PERSONALITY);
            expect(ALL_PERSONALITIES).toContain(ANALYTICAL_PERSONALITY);
            expect(ALL_PERSONALITIES).toContain(SOCIAL_PERSONALITY);
        });
    });

    describe("Individual Personalities", () => {
        it("neutral should have correct ID and traits", () => {
            expect(NEUTRAL_PERSONALITY.id).toBe("neutral");
            expect(NEUTRAL_PERSONALITY.name).toBe("Balanced");
            expect(NEUTRAL_PERSONALITY.traits.style).toContain("casual");
        });

        it("aggressive should have confrontational traits", () => {
            expect(AGGRESSIVE_PERSONALITY.id).toBe("aggressive");
            expect(AGGRESSIVE_PERSONALITY.traits.style).toContain("direct");
            expect(AGGRESSIVE_PERSONALITY.traits.questioning).toContain("pointed");
        });

        it("quiet should have reserved traits", () => {
            expect(QUIET_PERSONALITY.id).toBe("quiet");
            expect(QUIET_PERSONALITY.traits.style).toContain("brief");
            expect(QUIET_PERSONALITY.traits.questioning).toContain("simple");
        });

        it("paranoid should have suspicious traits", () => {
            expect(PARANOID_PERSONALITY.id).toBe("paranoid");
            expect(PARANOID_PERSONALITY.traits.suspicion).toContain("EVERYONE");
        });

        it("comedic should have playful traits", () => {
            expect(COMEDIC_PERSONALITY.id).toBe("comedic");
            expect(COMEDIC_PERSONALITY.traits.style).toContain("funny");
        });

        it("analytical should have logical traits", () => {
            expect(ANALYTICAL_PERSONALITY.id).toBe("analytical");
            expect(ANALYTICAL_PERSONALITY.traits.style).toContain("logical");
        });

        it("social should have friendly traits", () => {
            expect(SOCIAL_PERSONALITY.id).toBe("social");
            expect(SOCIAL_PERSONALITY.traits.style).toContain("friendly");
        });
    });

    describe("getPersonalityById", () => {
        it("should return correct personality for valid ID", () => {
            expect(getPersonalityById("neutral")).toBe(NEUTRAL_PERSONALITY);
            expect(getPersonalityById("aggressive")).toBe(AGGRESSIVE_PERSONALITY);
            expect(getPersonalityById("quiet")).toBe(QUIET_PERSONALITY);
            expect(getPersonalityById("paranoid")).toBe(PARANOID_PERSONALITY);
            expect(getPersonalityById("comedic")).toBe(COMEDIC_PERSONALITY);
            expect(getPersonalityById("analytical")).toBe(ANALYTICAL_PERSONALITY);
            expect(getPersonalityById("social")).toBe(SOCIAL_PERSONALITY);
        });

        it("should return neutral personality for invalid ID", () => {
            expect(getPersonalityById("invalid")).toBe(NEUTRAL_PERSONALITY);
            expect(getPersonalityById("")).toBe(NEUTRAL_PERSONALITY);
            expect(getPersonalityById("nonexistent")).toBe(NEUTRAL_PERSONALITY);
        });

        it("should handle case-sensitive IDs", () => {
            expect(getPersonalityById("AGGRESSIVE")).toBe(NEUTRAL_PERSONALITY);
            expect(getPersonalityById("Quiet")).toBe(NEUTRAL_PERSONALITY);
        });
    });

    describe("getRandomPersonality", () => {
        it("should return a non-neutral personality", () => {
            for (let i = 0; i < 10; i++) {
                const random = getRandomPersonality();
                expect(random.id).not.toBe("neutral");
                expect(ALL_PERSONALITIES).toContain(random);
            }
        });

        it("should return one of the 6 non-neutral personalities", () => {
            const possibleIds = ["aggressive", "quiet", "paranoid", "comedic", "analytical", "social"];
            const random = getRandomPersonality();
            expect(possibleIds).toContain(random.id);
        });

        it("should have variety (statistical test)", () => {
            const results = new Set<string>();
            for (let i = 0; i < 50; i++) {
                results.add(getRandomPersonality().id);
            }
            // Should get at least 3 different personalities in 50 tries
            expect(results.size).toBeGreaterThanOrEqual(3);
        });
    });

    describe("applyPersonalityToPrompt", () => {
        const basePrompt = "You are playing Spyfall. Follow the rules.";

        it("should return original prompt for neutral personality", () => {
            const result = applyPersonalityToPrompt(basePrompt, NEUTRAL_PERSONALITY);
            expect(result).toBe(basePrompt);
        });

        it("should add personality section for non-neutral personalities", () => {
            const result = applyPersonalityToPrompt(basePrompt, AGGRESSIVE_PERSONALITY);
            expect(result).toContain(basePrompt);
            expect(result).toContain("YOUR PERSONALITY");
            expect(result).toContain("Aggressive");
            expect(result).toContain("STYLE:");
            expect(result).toContain("WHEN ASKING:");
            expect(result).toContain("WHEN ANSWERING:");
            expect(result).toContain("REGARDING SUSPICION:");
            expect(result).toContain("WHEN DECIDING:");
        });

        it("should include personality traits in prompt", () => {
            const result = applyPersonalityToPrompt(basePrompt, COMEDIC_PERSONALITY);
            expect(result).toContain("funny");
            expect(result).toContain("humor");
        });

        it("should include all trait categories", () => {
            const result = applyPersonalityToPrompt(basePrompt, ANALYTICAL_PERSONALITY);
            expect(result).toContain(ANALYTICAL_PERSONALITY.traits.style);
            expect(result).toContain(ANALYTICAL_PERSONALITY.traits.questioning);
            expect(result).toContain(ANALYTICAL_PERSONALITY.traits.answering);
            expect(result).toContain(ANALYTICAL_PERSONALITY.traits.suspicion);
            expect(result).toContain(ANALYTICAL_PERSONALITY.traits.decisions);
        });

        it("should work with all non-neutral personalities", () => {
            const nonNeutral = ALL_PERSONALITIES.filter(p => p.id !== "neutral");
            
            nonNeutral.forEach(personality => {
                const result = applyPersonalityToPrompt(basePrompt, personality);
                expect(result).toContain(basePrompt);
                expect(result).toContain(personality.name);
                expect(result.length).toBeGreaterThan(basePrompt.length);
            });
        });

        it("should preserve base prompt content", () => {
            const longPrompt = "You are a spy. Your mission is secret. Don't reveal yourself.";
            const result = applyPersonalityToPrompt(longPrompt, PARANOID_PERSONALITY);
            expect(result).toContain(longPrompt);
            expect(result.indexOf(longPrompt)).toBe(0); // Should start with base prompt
        });
    });

    describe("Personality Traits Content", () => {
        it("all traits should be non-empty strings", () => {
            ALL_PERSONALITIES.forEach(personality => {
                expect(personality.traits.style.trim().length).toBeGreaterThan(0);
                expect(personality.traits.questioning.trim().length).toBeGreaterThan(0);
                expect(personality.traits.answering.trim().length).toBeGreaterThan(0);
                expect(personality.traits.suspicion.trim().length).toBeGreaterThan(0);
                expect(personality.traits.decisions.trim().length).toBeGreaterThan(0);
            });
        });

        it("traits should provide meaningful guidance", () => {
            ALL_PERSONALITIES.forEach(personality => {
                // Traits should be at least reasonably descriptive
                expect(personality.traits.style.length).toBeGreaterThan(15);
                expect(personality.traits.questioning.length).toBeGreaterThan(15);
                expect(personality.traits.answering.length).toBeGreaterThan(15);
                expect(personality.traits.suspicion.length).toBeGreaterThan(15);
                expect(personality.traits.decisions.length).toBeGreaterThan(15);
            });
        });
    });
});
