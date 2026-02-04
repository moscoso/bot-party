/** Supported AI providers */
export type ProviderType = "openai" | "anthropic" | "google";

/** Agent mode: how conversation history is managed */
export type AgentMode = "memory" | "stateful";

/** Standard message format used across all providers */
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

/** Provider interface - all AI providers must implement this */
export interface AIProvider {
    /** Provider identifier */
    readonly type: ProviderType;
    
    /** Display name for the agent (e.g., "GPT-4", "Claude", "Gemini") */
    readonly displayName: string;
    
    /** Whether this provider supports stateful (server-side history) mode */
    readonly supportsStateful: boolean;
    
    /** 
     * Initialize the provider for a conversation.
     * For stateful mode, this sets up the thread/session with the system prompt.
     * For memory mode, this may be a no-op.
     */
    init(systemPrompt: string): Promise<void>;
    
    /** 
     * Stateless chat - client sends full message history each time.
     * Works with all providers.
     */
    chat(messages: ChatMessage[]): Promise<string>;
    
    /** 
     * Stateful chat - provider manages conversation history server-side.
     * Only works if supportsStateful is true. Call init() first.
     * @param userContent - Just the user's message (no history needed)
     */
    chatStateful(userContent: string): Promise<string>;
    
    /** 
     * Cleanup any resources (threads, sessions, etc.).
     * Should be called when done with this provider instance.
     */
    cleanup(): Promise<void>;
}

/** Configuration for creating a provider */
export interface ProviderConfig {
    type: ProviderType;
    /** Optional model override (uses provider default if not specified) */
    model?: string;
}
