export * from "./types";
export { OpenAIProvider } from "./openai.provider";
export { AnthropicProvider } from "./anthropic.provider";
export { GoogleProvider } from "./google.provider";
export { 
    validateAPIKey, 
    getAPIKey, 
    hasAPIKey, 
    getAvailableProviders,
    APIKeyError,
    ProviderAPIError 
} from "./validation";

import { AIProvider, ProviderConfig, ProviderType } from "./types";
import { OpenAIProvider } from "./openai.provider";
import { AnthropicProvider } from "./anthropic.provider";
import { GoogleProvider } from "./google.provider";

/** Create a provider instance from config */
export function createProvider(config: ProviderConfig): AIProvider {
    switch (config.type) {
        case "openai":
            return new OpenAIProvider(config.model);
        case "anthropic":
            return new AnthropicProvider(config.model);
        case "google":
            return new GoogleProvider(config.model);
        default:
            throw new Error(`Unknown provider type: ${config.type}`);
    }
}

/** Get all available provider types */
export const PROVIDER_TYPES: ProviderType[] = ["openai", "anthropic", "google"];

/** Default provider rotation for multi-agent games */
export const DEFAULT_PROVIDER_ROTATION: ProviderType[] = ["openai", "anthropic", "google"];

/** Map of provider types to their display names */
export const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
    openai: "GPT",
    anthropic: "Claude",
    google: "Gemini",
};

/** Get display name for a provider type */
export function getProviderDisplayName(type: ProviderType): string {
    return PROVIDER_DISPLAY_NAMES[type] || type;
}

/** Provider capabilities info for client */
export interface ProviderInfo {
    displayName: string;
    supportsStateful: boolean;
}

/** Get capabilities for all providers (for client-side config UI) */
export function getProviderCapabilities(): Record<ProviderType, ProviderInfo> {
    // Create temporary instances to read their capabilities
    const providers: Record<ProviderType, AIProvider> = {
        openai: new OpenAIProvider(),
        anthropic: new AnthropicProvider(),
        google: new GoogleProvider(),
    };
    
    const result: Record<ProviderType, ProviderInfo> = {} as any;
    for (const type of PROVIDER_TYPES) {
        const provider = providers[type];
        result[type] = {
            displayName: provider.displayName,
            supportsStateful: provider.supportsStateful,
        };
    }
    return result;
}
