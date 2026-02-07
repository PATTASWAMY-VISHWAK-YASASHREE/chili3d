// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ChatChunk, ChatMessage, ChatRequest, LLMCapabilities } from "../provider";
import { BaseProvider } from "./base-provider";

/**
 * Google Gemini provider adapter.
 * Supports Gemini 2.0 Flash/Pro with streaming, function calling, and vision.
 */
export class GoogleProvider extends BaseProvider {
    readonly id = "google";
    readonly displayName: string;
    readonly capabilities: LLMCapabilities;
    private readonly modelName: string;
    private readonly embeddingModel: string;

    constructor(
        apiKey: string,
        options?: {
            model?: string;
            embeddingModel?: string;
            baseUrl?: string;
        },
    ) {
        super(apiKey, options?.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta");
        this.modelName = options?.model ?? "gemini-2.0-flash";
        this.embeddingModel = options?.embeddingModel ?? "text-embedding-004";
        this.displayName = this.modelName;
        this.capabilities = {
            supportsVision: true,
            supportsStreaming: true,
            supportsFunctionCalling: true,
            maxContextTokens: 1_000_000,
            maxOutputTokens: 8_192,
            embeddingDimensions: 768,
        };
    }

    async *chat(request: ChatRequest): AsyncIterable<ChatChunk> {
        const body = this.buildRequestBody(request);
        const url = `${this.baseUrl}/models/${this.modelName}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

        const response = await this.fetchWithRetry(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: request.signal,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google Gemini API error (${response.status}): ${error}`);
        }

        for await (const data of this.parseSSEStream(response)) {
            const parsed = JSON.parse(data);
            const candidate = parsed.candidates?.[0];
            if (!candidate) continue;

            const chunk: ChatChunk = { delta: "" };

            const parts = candidate.content?.parts ?? [];
            for (const part of parts) {
                if (part.text) {
                    chunk.delta += part.text;
                }
                if (part.functionCall) {
                    chunk.toolCalls = [
                        {
                            id: `call_${Date.now()}`,
                            name: part.functionCall.name,
                            input: part.functionCall.args ?? {},
                        },
                    ];
                }
            }

            if (candidate.finishReason) {
                chunk.finishReason = candidate.finishReason === "STOP" ? "stop" : "stop";
            }

            if (parsed.usageMetadata) {
                chunk.usage = this.computeUsageCost(this.modelName, {
                    promptTokens: parsed.usageMetadata.promptTokenCount ?? 0,
                    completionTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
                    totalTokens: parsed.usageMetadata.totalTokenCount ?? 0,
                });
            }

            yield chunk;
        }
    }

    async embedText(texts: string[]): Promise<Float32Array[]> {
        const results: Float32Array[] = [];

        for (const text of texts) {
            const response = await this.fetchWithRetry(
                `${this.baseUrl}/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: `models/${this.embeddingModel}`,
                        content: { parts: [{ text }] },
                    }),
                },
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Google Embeddings API error (${response.status}): ${error}`);
            }

            const result = await response.json();
            results.push(new Float32Array(result.embedding.values));
        }

        return results;
    }

    private buildRequestBody(request: ChatRequest): Record<string, unknown> {
        const contents = this.convertMessages(request.messages);

        const body: Record<string, unknown> = { contents };

        const systemMessages = request.messages.filter((m) => m.role === "system");
        if (systemMessages.length > 0) {
            const systemText = systemMessages
                .flatMap((m) => m.content)
                .filter((c) => c.type === "text")
                .map((c) => c.text)
                .join("\n\n");
            body.systemInstruction = { parts: [{ text: systemText }] };
        }

        const generationConfig: Record<string, unknown> = {};
        if (request.temperature !== undefined) {
            generationConfig.temperature = request.temperature;
        }
        if (request.maxTokens !== undefined) {
            generationConfig.maxOutputTokens = request.maxTokens;
        }
        if (request.responseFormat === "json") {
            generationConfig.responseMimeType = "application/json";
        }
        if (Object.keys(generationConfig).length > 0) {
            body.generationConfig = generationConfig;
        }

        if (request.tools && request.tools.length > 0) {
            body.tools = [
                {
                    functionDeclarations: request.tools.map((t) => ({
                        name: t.name,
                        description: t.description,
                        parameters: t.parameters,
                    })),
                },
            ];
        }

        return body;
    }

    private convertMessages(messages: ChatMessage[]): unknown[] {
        return messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: m.content.map((part) => {
                    if (part.type === "text") {
                        return { text: part.text };
                    }
                    if (part.type === "image") {
                        return {
                            inlineData: {
                                mimeType: part.mimeType,
                                data: this.arrayBufferToBase64(part.data),
                            },
                        };
                    }
                    return { text: "" };
                }),
            }));
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }
        return btoa(binary);
    }
}
