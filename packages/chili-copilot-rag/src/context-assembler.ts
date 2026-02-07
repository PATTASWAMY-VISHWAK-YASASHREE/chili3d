// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ChatMessage, ILLMProvider } from "chili-copilot";
import { estimateTokens } from "./utils";
import type { IVectorStore } from "./vector-store";

/**
 * Assembles the optimal context window for each LLM call.
 * Uses a priority-based strategy to maximize relevance
 * within the token budget.
 *
 * Priority order:
 *   1. System prompt (fixed, ~500 tokens)
 *   2. Active scene context (node tree, ~200-2000 tokens)
 *   3. RAG results (top-K relevant chunks, ~1000-4000 tokens)
 *   4. Conversation history (sliding window, remaining budget)
 */
export class ContextAssembler {
    constructor(
        private readonly vectorStore: IVectorStore,
        private readonly provider: ILLMProvider,
    ) {}

    /**
     * Build the context messages for a user query.
     */
    async buildContext(
        query: string,
        conversationHistory: ChatMessage[],
        sceneContext: string,
        tokenBudget: number,
        systemPrompt?: string,
    ): Promise<ChatMessage[]> {
        const messages: ChatMessage[] = [];
        let usedTokens = 0;

        // 1. System prompt
        const system = systemPrompt ?? this.defaultSystemPrompt();
        usedTokens += estimateTokens(system);
        messages.push({
            role: "system",
            content: [{ type: "text", text: system }],
        });

        // 2. Scene context (always included)
        usedTokens += estimateTokens(sceneContext);

        // 3. RAG retrieval
        let ragContext = "";
        if (this.vectorStore.count > 0) {
            try {
                const queryEmbedding = (await this.provider.embedText([query]))[0];
                const ragBudget = Math.min(4000, Math.floor((tokenBudget - usedTokens) * 0.4));
                const ragResults = await this.vectorStore.search(queryEmbedding, 10);
                ragContext = this.selectChunks(
                    ragResults.map((r) => r.document.content),
                    ragBudget,
                );
                usedTokens += estimateTokens(ragContext);
            } catch {
                // Embedding not available — skip RAG
            }
        }

        // 4. Conversation history (sliding window from most recent)
        const historyBudget = tokenBudget - usedTokens - estimateTokens(query) - 500;
        const history = this.truncateHistory(conversationHistory, historyBudget);
        messages.push(...history);

        // Final user message with scene and RAG context
        const userParts: Array<{ type: "text"; text: string }> = [];
        if (sceneContext) {
            userParts.push({ type: "text", text: `Scene:\n${sceneContext}` });
        }
        if (ragContext) {
            userParts.push({ type: "text", text: `Relevant context:\n${ragContext}` });
        }
        userParts.push({ type: "text", text: query });

        messages.push({ role: "user", content: userParts });

        return messages;
    }

    private selectChunks(chunks: string[], budgetTokens: number): string {
        const selected: string[] = [];
        let used = 0;

        for (const chunk of chunks) {
            const tokens = estimateTokens(chunk);
            if (used + tokens > budgetTokens) break;
            selected.push(chunk);
            used += tokens;
        }

        return selected.join("\n\n---\n\n");
    }

    private truncateHistory(history: ChatMessage[], budgetTokens: number): ChatMessage[] {
        if (budgetTokens <= 0) return [];

        const result: ChatMessage[] = [];
        let used = 0;

        // Take from most recent, working backwards
        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            const text = msg.content
                .filter((c) => c.type === "text")
                .map((c) => c.text)
                .join(" ");
            const tokens = estimateTokens(text);

            if (used + tokens > budgetTokens) break;
            result.unshift(msg);
            used += tokens;
        }

        return result;
    }

    private defaultSystemPrompt(): string {
        return (
            "You are a CAD Copilot assistant for Chili3D. " +
            "You help users create, modify, and reason about 3D geometry. " +
            "You can create sketches, extrude shapes, perform boolean operations, " +
            "apply materials, and query the scene graph. " +
            "Always explain your reasoning step by step."
        );
    }
}
