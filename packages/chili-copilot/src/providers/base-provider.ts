// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { computeCost } from "../pricing";
import type { ChatChunk, ChatRequest, ILLMProvider, LLMCapabilities, TokenUsage } from "../provider";

/**
 * Base class for LLM provider adapters, providing shared utilities
 * such as retry with exponential backoff and streaming helpers.
 */
export abstract class BaseProvider implements ILLMProvider {
    abstract readonly id: string;
    abstract readonly displayName: string;
    abstract readonly capabilities: LLMCapabilities;

    protected apiKey: string;
    protected baseUrl: string;

    constructor(apiKey: string, baseUrl: string) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    abstract chat(request: ChatRequest): AsyncIterable<ChatChunk>;
    abstract embedText(texts: string[]): Promise<Float32Array[]>;

    /**
     * Fetch with retry and exponential backoff for rate-limit errors (429).
     */
    protected async fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, init);
                if (response.status === 429 && attempt < maxRetries) {
                    const retryAfter = response.headers.get("Retry-After");
                    const delay = retryAfter
                        ? Number.parseInt(retryAfter, 10) * 1000
                        : Math.min(1000 * 2 ** attempt + Math.random() * 1000, 30000);
                    await this.sleep(delay);
                    continue;
                }
                return response;
            } catch (error) {
                lastError = error as Error;
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * 2 ** attempt + Math.random() * 1000, 30000);
                    await this.sleep(delay);
                }
            }
        }

        throw lastError ?? new Error("Request failed after retries");
    }

    protected sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Parse an SSE stream line by line, yielding data payload strings.
     */
    protected async *parseSSEStream(response: Response): AsyncIterable<string> {
        const reader = response.body?.getReader();
        if (!reader) {
            return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith("data: ")) {
                        const data = trimmed.slice(6);
                        if (data === "[DONE]") {
                            return;
                        }
                        yield data;
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Compute cost for token usage given a model name.
     */
    protected computeUsageCost(modelName: string, usage: TokenUsage): TokenUsage {
        return {
            ...usage,
            costUsd: computeCost(
                modelName,
                usage.promptTokens,
                usage.completionTokens,
                usage.cachedTokens ?? 0,
            ),
        };
    }

    dispose(): void {
        // Base cleanup — subclasses may override
    }
}
