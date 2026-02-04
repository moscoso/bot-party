import OpenAI from "openai";
import dotenv from "dotenv";
import { AIProvider, ChatMessage, ProviderType } from "./types";

dotenv.config();

const DEFAULT_MODEL = "gpt-4.1-mini";

export class OpenAIProvider implements AIProvider {
    readonly type: ProviderType = "openai";
    readonly displayName = "GPT";
    readonly supportsStateful = true;
    
    private client: OpenAI;
    private model: string;
    
    // Stateful mode state (Assistants API)
    private assistantId?: string;
    private threadId?: string;

    constructor(model?: string) {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        this.model = model || process.env.OPENAI_MODEL || DEFAULT_MODEL;
    }

    async init(systemPrompt: string): Promise<void> {
        // Create an Assistant with the system prompt as instructions
        const assistant = await this.client.beta.assistants.create({
            name: "GameAgent",
            instructions: systemPrompt,
            model: this.model,
        });
        this.assistantId = assistant.id;

        // Create a Thread for the conversation
        const thread = await this.client.beta.threads.create();
        this.threadId = thread.id;
    }

    async chat(messages: ChatMessage[]): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
        });

        return response.choices[0]?.message?.content?.trim() || "(no response)";
    }

    async chatStateful(userContent: string): Promise<string> {
        if (!this.threadId || !this.assistantId) {
            throw new Error("Provider not initialized. Call init() first.");
        }

        // Add user message to thread
        await this.client.beta.threads.messages.create(this.threadId, {
            role: "user",
            content: userContent,
        });

        // Run the assistant and wait for completion
        const run = await this.client.beta.threads.runs.createAndPoll(this.threadId, {
            assistant_id: this.assistantId,
        });

        if (run.status !== "completed") {
            throw new Error(`Run failed with status: ${run.status}`);
        }

        // Get the latest assistant message
        const messages = await this.client.beta.threads.messages.list(this.threadId, { 
            limit: 1, 
            order: "desc" 
        });
        const lastMsg = messages.data[0];
        const textBlock = lastMsg?.content?.find((c) => c.type === "text");
        
        return (textBlock?.type === "text" ? textBlock.text?.value?.trim() : null) || "(no response)";
    }

    async cleanup(): Promise<void> {
        try {
            if (this.threadId) {
                await this.client.beta.threads.delete(this.threadId);
            }
            if (this.assistantId) {
                await this.client.beta.assistants.delete(this.assistantId);
            }
        } catch {
            // Ignore cleanup errors
        }
        this.threadId = undefined;
        this.assistantId = undefined;
    }
}
