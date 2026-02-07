import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { AIProvider, ChatMessage, ProviderType } from "./types";
import { getAPIKey, wrapProviderCall } from "./validation";

dotenv.config();

const DEFAULT_MODEL = "gemini-2.0-flash";
const STATEFUL_MODEL = "gemini-2.5-flash"; // Interactions API requires newer model

export class GoogleProvider implements AIProvider {
    readonly type: ProviderType = "google";
    readonly displayName = "Gemini";
    readonly supportsStateful = true;
    
    // Legacy client for memory mode (Chat Completions style)
    private legacyClient: GoogleGenerativeAI;
    
    // New client for stateful mode (Interactions API)
    private genaiClient: GoogleGenAI;
    
    private model: string;
    private systemPrompt?: string;
    
    // Stateful mode state
    private lastInteractionId?: string;

    constructor(model?: string) {
        const apiKey = getAPIKey("google");
        this.legacyClient = new GoogleGenerativeAI(apiKey);
        this.genaiClient = new GoogleGenAI({ apiKey });
        this.model = model || process.env.GOOGLE_MODEL || DEFAULT_MODEL;
    }

    async init(systemPrompt: string): Promise<void> {
        this.systemPrompt = systemPrompt;
        this.lastInteractionId = undefined;
        // Stateful mode initialization is lazy - first interaction creates the chain
    }

    async chat(messages: ChatMessage[]): Promise<string> {
        return wrapProviderCall("google", "chat completion", async () => {
            // Extract system instruction and convert messages to Gemini format
            const systemMessage = messages.find(m => m.role === "system");
            const nonSystemMessages = messages.filter(m => m.role !== "system");

            // Pass systemInstruction to getGenerativeModel (accepts plain string)
            const genModel = this.legacyClient.getGenerativeModel({ 
                model: this.model,
                systemInstruction: systemMessage?.content,
            });

            // Gemini uses "user" and "model" roles
            const history = nonSystemMessages.slice(0, -1).map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
            }));

            const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];

            const chat = genModel.startChat({
                history: history as any,
            });

            const result = await chat.sendMessage(lastMessage?.content || "");
            const response = await result.response;
            
            return response.text()?.trim() || "(no response)";
        });
    }

    async chatStateful(userContent: string): Promise<string> {
        return wrapProviderCall("google", "stateful chat", async () => {
            // Use Interactions API for stateful conversations
            // See: https://ai.google.dev/gemini-api/docs/interactions
            
            const interactionParams: any = {
                model: STATEFUL_MODEL,
                input: userContent,
            };

            // Add system instruction on first call
            if (!this.lastInteractionId && this.systemPrompt) {
                interactionParams.system_instruction = this.systemPrompt;
            }

            // Chain to previous interaction if exists
            if (this.lastInteractionId) {
                interactionParams.previous_interaction_id = this.lastInteractionId;
            }

            const interaction = await this.genaiClient.interactions.create(interactionParams);
            
            // Store interaction ID for next turn
            this.lastInteractionId = interaction.id;

            // Find the text output from the response
            const outputs = interaction.outputs || [];
            for (const output of outputs) {
                if (output.type === "text" && "text" in output) {
                    return (output.text as string)?.trim() || "(no response)";
                }
            }
            return "(no response)";
        });
    }

    async cleanup(): Promise<void> {
        // Interactions are automatically cleaned up by Google after retention period
        // We just reset our local state
        this.lastInteractionId = undefined;
        this.systemPrompt = undefined;
    }
}
