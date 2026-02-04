import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { AIProvider, ChatMessage, ProviderType } from "./types";

dotenv.config();

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export class AnthropicProvider implements AIProvider {
    readonly type: ProviderType = "anthropic";
    readonly displayName = "Claude";
    readonly supportsStateful = false;
    
    private client: Anthropic;
    private model: string;

    constructor(model?: string) {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.model = model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
    }

    async init(_systemPrompt: string): Promise<void> {
        // No-op for Anthropic - stateful mode not supported
        // System prompt is passed with each chat() call
    }

    async chat(messages: ChatMessage[]): Promise<string> {
        // Anthropic requires system message to be separate
        const systemMessage = messages.find(m => m.role === "system");
        const nonSystemMessages = messages.filter(m => m.role !== "system");

        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 1024,
            system: systemMessage?.content || "",
            messages: nonSystemMessages.map(m => ({
                role: m.role as "user" | "assistant",
                content: m.content,
            })),
        });

        const textBlock = response.content.find(block => block.type === "text");
        return textBlock?.type === "text" ? textBlock.text.trim() : "(no response)";
    }

    async chatStateful(_userContent: string): Promise<string> {
        throw new Error("Stateful mode is not supported by Anthropic provider. Use chat() instead.");
    }

    async cleanup(): Promise<void> {
        // No-op for Anthropic - no resources to clean up
    }
}
