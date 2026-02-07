import { ProviderType } from "./types";

/** API key environment variable names */
const API_KEY_ENV_VARS: Record<ProviderType, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
};

/** Provider setup documentation links */
const SETUP_DOCS: Record<ProviderType, string> = {
    openai: "https://platform.openai.com/api-keys",
    anthropic: "https://console.anthropic.com/settings/keys",
    google: "https://aistudio.google.com/app/apikey",
};

/** Error thrown when API key is missing or invalid */
export class APIKeyError extends Error {
    constructor(
        public readonly provider: ProviderType,
        public readonly envVar: string,
        public readonly setupUrl: string
    ) {
        super(
            `Missing API key for ${provider}. ` +
            `Please set ${envVar} in your .env file. ` +
            `Get your API key at: ${setupUrl}`
        );
        this.name = "APIKeyError";
    }
}

/** Error thrown when API call fails (network, auth, rate limit, etc.) */
export class ProviderAPIError extends Error {
    constructor(
        public readonly provider: ProviderType,
        public readonly originalError: Error,
        public readonly context?: string
    ) {
        const contextMsg = context ? ` (${context})` : "";
        super(
            `${provider} API error${contextMsg}: ${originalError.message}\n` +
            `Check your API key and provider status.`
        );
        this.name = "ProviderAPIError";
        this.cause = originalError;
    }
}

/** Validate that API key exists for a provider */
export function validateAPIKey(provider: ProviderType): void {
    const envVar = API_KEY_ENV_VARS[provider];
    const apiKey = process.env[envVar];
    
    if (!apiKey || apiKey.trim() === "") {
        throw new APIKeyError(provider, envVar, SETUP_DOCS[provider]);
    }
}

/** Get API key for a provider (throws if missing) */
export function getAPIKey(provider: ProviderType): string {
    validateAPIKey(provider);
    return process.env[API_KEY_ENV_VARS[provider]]!;
}

/** Check if API key is configured for a provider */
export function hasAPIKey(provider: ProviderType): boolean {
    const apiKey = process.env[API_KEY_ENV_VARS[provider]];
    return !!apiKey && apiKey.trim() !== "";
}

/** Get list of providers with valid API keys */
export function getAvailableProviders(): ProviderType[] {
    const providers: ProviderType[] = ["openai", "anthropic", "google"];
    return providers.filter(hasAPIKey);
}

/** 
 * Wrap an async provider operation with better error handling.
 * Converts SDK errors into more user-friendly ProviderAPIError.
 */
export async function wrapProviderCall<T>(
    provider: ProviderType,
    context: string,
    fn: () => Promise<T>
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (error instanceof APIKeyError || error instanceof ProviderAPIError) {
            throw error; // Already wrapped, re-throw as-is
        }
        throw new ProviderAPIError(provider, error as Error, context);
    }
}
