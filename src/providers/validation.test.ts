import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    APIKeyError,
    ProviderAPIError,
    validateAPIKey,
    getAPIKey,
    hasAPIKey,
    getAvailableProviders,
    wrapProviderCall,
} from "./validation";
import type { ProviderType } from "./types";

describe("API Key Validation", () => {
    // Store original env vars to restore after tests
    const originalEnv = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    };

    afterEach(() => {
        // Restore original environment variables
        process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
        process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
        process.env.GOOGLE_API_KEY = originalEnv.GOOGLE_API_KEY;
    });

    describe("APIKeyError", () => {
        it("should create error with correct properties", () => {
            const error = new APIKeyError("openai", "OPENAI_API_KEY", "https://example.com");
            
            expect(error.name).toBe("APIKeyError");
            expect(error.provider).toBe("openai");
            expect(error.envVar).toBe("OPENAI_API_KEY");
            expect(error.setupUrl).toBe("https://example.com");
            expect(error.message).toContain("openai");
            expect(error.message).toContain("OPENAI_API_KEY");
            expect(error.message).toContain("https://example.com");
        });

        it("should be an instance of Error", () => {
            const error = new APIKeyError("anthropic", "ANTHROPIC_API_KEY", "https://example.com");
            expect(error instanceof Error).toBe(true);
            expect(error instanceof APIKeyError).toBe(true);
        });

        it("should have informative error message for each provider", () => {
            const providers: ProviderType[] = ["openai", "anthropic", "google"];
            
            providers.forEach(provider => {
                const error = new APIKeyError(provider, `${provider.toUpperCase()}_API_KEY`, "https://example.com");
                expect(error.message).toContain("Missing API key");
                expect(error.message).toContain(provider);
                expect(error.message).toContain("Get your API key");
            });
        });
    });

    describe("ProviderAPIError", () => {
        it("should wrap original error", () => {
            const originalError = new Error("Network timeout");
            const providerError = new ProviderAPIError("openai", originalError);
            
            expect(providerError.name).toBe("ProviderAPIError");
            expect(providerError.provider).toBe("openai");
            expect(providerError.originalError).toBe(originalError);
            expect(providerError.cause).toBe(originalError);
            expect(providerError.message).toContain("openai");
            expect(providerError.message).toContain("Network timeout");
        });

        it("should include context when provided", () => {
            const originalError = new Error("Rate limit exceeded");
            const providerError = new ProviderAPIError("anthropic", originalError, "chat completion");
            
            expect(providerError.context).toBe("chat completion");
            expect(providerError.message).toContain("chat completion");
            expect(providerError.message).toContain("Rate limit exceeded");
        });

        it("should work without context", () => {
            const originalError = new Error("Auth failed");
            const providerError = new ProviderAPIError("google", originalError);
            
            expect(providerError.context).toBeUndefined();
            expect(providerError.message).toContain("google");
            expect(providerError.message).toContain("Auth failed");
        });
    });

    describe("validateAPIKey", () => {
        it("should pass when API key is set", () => {
            process.env.OPENAI_API_KEY = "sk-test123";
            expect(() => validateAPIKey("openai")).not.toThrow();
        });

        it("should throw APIKeyError when key is missing", () => {
            delete process.env.ANTHROPIC_API_KEY;
            
            expect(() => validateAPIKey("anthropic")).toThrow(APIKeyError);
            
            try {
                validateAPIKey("anthropic");
            } catch (error) {
                expect(error instanceof APIKeyError).toBe(true);
                if (error instanceof APIKeyError) {
                    expect(error.provider).toBe("anthropic");
                    expect(error.envVar).toBe("ANTHROPIC_API_KEY");
                }
            }
        });

        it("should throw when key is empty string", () => {
            process.env.GOOGLE_API_KEY = "";
            expect(() => validateAPIKey("google")).toThrow(APIKeyError);
        });

        it("should throw when key is only whitespace", () => {
            process.env.OPENAI_API_KEY = "   ";
            expect(() => validateAPIKey("openai")).toThrow(APIKeyError);
        });

        it("should work for all provider types", () => {
            const providers: ProviderType[] = ["openai", "anthropic", "google"];
            
            providers.forEach(provider => {
                delete (process.env as any)[`${provider.toUpperCase()}_API_KEY`];
                expect(() => validateAPIKey(provider)).toThrow(APIKeyError);
            });
        });
    });

    describe("getAPIKey", () => {
        it("should return API key when valid", () => {
            process.env.OPENAI_API_KEY = "sk-test-key-123";
            expect(getAPIKey("openai")).toBe("sk-test-key-123");
        });

        it("should throw when key is missing", () => {
            delete process.env.ANTHROPIC_API_KEY;
            expect(() => getAPIKey("anthropic")).toThrow(APIKeyError);
        });

        it("should return correct key for each provider", () => {
            process.env.OPENAI_API_KEY = "openai-key";
            process.env.ANTHROPIC_API_KEY = "anthropic-key";
            process.env.GOOGLE_API_KEY = "google-key";
            
            expect(getAPIKey("openai")).toBe("openai-key");
            expect(getAPIKey("anthropic")).toBe("anthropic-key");
            expect(getAPIKey("google")).toBe("google-key");
        });
    });

    describe("hasAPIKey", () => {
        it("should return true when key is set", () => {
            process.env.OPENAI_API_KEY = "sk-test123";
            expect(hasAPIKey("openai")).toBe(true);
        });

        it("should return false when key is missing", () => {
            delete process.env.ANTHROPIC_API_KEY;
            expect(hasAPIKey("anthropic")).toBe(false);
        });

        it("should return false when key is empty", () => {
            process.env.GOOGLE_API_KEY = "";
            expect(hasAPIKey("google")).toBe(false);
        });

        it("should return false when key is whitespace", () => {
            process.env.OPENAI_API_KEY = "   ";
            expect(hasAPIKey("openai")).toBe(false);
        });

        it("should not throw errors", () => {
            delete process.env.ANTHROPIC_API_KEY;
            expect(() => hasAPIKey("anthropic")).not.toThrow();
        });
    });

    describe("getAvailableProviders", () => {
        it("should return empty array when no keys are set", () => {
            delete process.env.OPENAI_API_KEY;
            delete process.env.ANTHROPIC_API_KEY;
            delete process.env.GOOGLE_API_KEY;
            
            expect(getAvailableProviders()).toEqual([]);
        });

        it("should return providers with valid keys", () => {
            process.env.OPENAI_API_KEY = "key1";
            process.env.ANTHROPIC_API_KEY = "key2";
            delete process.env.GOOGLE_API_KEY;
            
            const available = getAvailableProviders();
            expect(available).toContain("openai");
            expect(available).toContain("anthropic");
            expect(available).not.toContain("google");
            expect(available).toHaveLength(2);
        });

        it("should return all providers when all keys are set", () => {
            process.env.OPENAI_API_KEY = "key1";
            process.env.ANTHROPIC_API_KEY = "key2";
            process.env.GOOGLE_API_KEY = "key3";
            
            const available = getAvailableProviders();
            expect(available).toContain("openai");
            expect(available).toContain("anthropic");
            expect(available).toContain("google");
            expect(available).toHaveLength(3);
        });

        it("should only return valid providers (not empty/whitespace)", () => {
            process.env.OPENAI_API_KEY = "valid-key";
            process.env.ANTHROPIC_API_KEY = "";
            process.env.GOOGLE_API_KEY = "   ";
            
            const available = getAvailableProviders();
            expect(available).toEqual(["openai"]);
        });
    });

    describe("wrapProviderCall", () => {
        it("should return successful result", async () => {
            const fn = async () => "success";
            const result = await wrapProviderCall("openai", "test operation", fn);
            expect(result).toBe("success");
        });

        it("should return any type of result", async () => {
            const objFn = async () => ({ data: "test" });
            const numFn = async () => 42;
            const arrFn = async () => [1, 2, 3];
            
            expect(await wrapProviderCall("openai", "obj", objFn)).toEqual({ data: "test" });
            expect(await wrapProviderCall("openai", "num", numFn)).toBe(42);
            expect(await wrapProviderCall("openai", "arr", arrFn)).toEqual([1, 2, 3]);
        });

        it("should wrap generic errors in ProviderAPIError", async () => {
            const fn = async () => {
                throw new Error("Network error");
            };
            
            await expect(wrapProviderCall("anthropic", "chat", fn)).rejects.toThrow(ProviderAPIError);
            
            try {
                await wrapProviderCall("anthropic", "chat", fn);
            } catch (error) {
                expect(error instanceof ProviderAPIError).toBe(true);
                if (error instanceof ProviderAPIError) {
                    expect(error.provider).toBe("anthropic");
                    expect(error.context).toBe("chat");
                    expect(error.originalError.message).toBe("Network error");
                }
            }
        });

        it("should re-throw APIKeyError without wrapping", async () => {
            const fn = async () => {
                throw new APIKeyError("google", "GOOGLE_API_KEY", "https://example.com");
            };
            
            await expect(wrapProviderCall("google", "test", fn)).rejects.toThrow(APIKeyError);
            
            try {
                await wrapProviderCall("google", "test", fn);
            } catch (error) {
                expect(error instanceof APIKeyError).toBe(true);
                expect(error instanceof ProviderAPIError).toBe(false);
            }
        });

        it("should re-throw ProviderAPIError without double-wrapping", async () => {
            const originalError = new Error("Original");
            const providerError = new ProviderAPIError("openai", originalError, "first wrap");
            
            const fn = async () => {
                throw providerError;
            };
            
            try {
                await wrapProviderCall("openai", "second wrap", fn);
            } catch (error) {
                expect(error).toBe(providerError); // Same instance, not wrapped again
                if (error instanceof ProviderAPIError) {
                    expect(error.context).toBe("first wrap"); // Original context preserved
                }
            }
        });

        it("should work with different providers", async () => {
            const providers: ProviderType[] = ["openai", "anthropic", "google"];
            
            for (const provider of providers) {
                const fn = async () => {
                    throw new Error("Test error");
                };
                
                try {
                    await wrapProviderCall(provider, "test", fn);
                } catch (error) {
                    expect(error instanceof ProviderAPIError).toBe(true);
                    if (error instanceof ProviderAPIError) {
                        expect(error.provider).toBe(provider);
                    }
                }
            }
        });

        it("should preserve error stack trace", async () => {
            const fn = async () => {
                throw new Error("Stack test");
            };
            
            try {
                await wrapProviderCall("openai", "test", fn);
            } catch (error) {
                if (error instanceof ProviderAPIError) {
                    expect(error.originalError.stack).toBeDefined();
                }
            }
        });
    });
});
