// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ChatChunk, ChatMessage, ChatRequest, LLMCapabilities } from "../provider";
import { BaseProvider } from "./base-provider";

/**
 * OpenAI provider adapter.
 * Supports GPT-4o, GPT-4o-mini, and text-embedding-3-small.
 */
export class OpenAIProvider extends BaseProvider {
    readonly id = "openai";
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
        super(apiKey, options?.baseUrl ?? "https://api.openai.com/v1");
        this.modelName = options?.model ?? "gpt-4o";
        this.embeddingModel = options?.embeddingModel ?? "text-embedding-3-small";
        this.displayName = this.modelName;
        this.capabilities = {
            supportsVision: true,
            supportsStreaming: true,
            supportsFunctionCalling: true,
            maxContextTokens: 128_000,
            maxOutputTokens: 16_384,
            embeddingDimensions: 1536,
        };
    }

    async *chat(request: ChatRequest): AsyncIterable<ChatChunk> {
        const body = this.buildRequestBody(request);
        const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: request.signal,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${error}`);
        }

        for await (const data of this.parseSSEStream(response)) {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const chunk: ChatChunk = {
                delta: choice.delta?.content ?? "",
                finishReason: choice.finish_reason ?? undefined,
            };

            if (choice.delta?.tool_calls) {
                chunk.toolCalls = choice.delta.tool_calls.map(
                    (tc: { id: string; function: { name: string; arguments: string } }) => ({
                        id: tc.id,
                        name: tc.function.name,
                        input: JSON.parse(tc.function.arguments || "{}"),
                    }),
                );
            }

            if (parsed.usage) {
                chunk.usage = this.computeUsageCost(this.modelName, {
                    promptTokens: parsed.usage.prompt_tokens,
                    completionTokens: parsed.usage.completion_tokens,
                    totalTokens: parsed.usage.total_tokens,
                    cachedTokens: parsed.usage.prompt_tokens_details?.cached_tokens,
                });
            }

            yield chunk;
        }
    }

    async embedText(texts: string[]): Promise<Float32Array[]> {
        const response = await this.fetchWithRetry(`${this.baseUrl}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.embeddingModel,
                input: texts,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI Embeddings API error (${response.status}): ${error}`);
        }

        const result = await response.json();
        return result.data.map((item: { embedding: number[] }) => new Float32Array(item.embedding));
    }

    private buildRequestBody(request: ChatRequest): Record<string, unknown> {
        const body: Record<string, unknown> = {
            model: this.modelName,
            messages: request.messages.map((m) => this.convertMessage(m)),
            stream: true,
            stream_options: { include_usage: true },
        };

        if (request.temperature !== undefined) {
            body.temperature = request.temperature;
        }
        if (request.maxTokens !== undefined) {
            body.max_tokens = request.maxTokens;
        }
        if (request.responseFormat === "json") {
            body.response_format = { type: "json_object" };
        }
        if (request.tools && request.tools.length > 0) {
            body.tools = request.tools.map((t) => ({
                type: "function",
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                },
            }));
        }

        return body;
    }

    private convertMessage(message: ChatMessage): Record<string, unknown> {
        const content: unknown[] = [];
        for (const part of message.content) {
            if (part.type === "text") {
                content.push({ type: "text", text: part.text });
            } else if (part.type === "image") {
                const base64 = this.arrayBufferToBase64(part.data);
                content.push({
                    type: "image_url",
                    image_url: { url: `data:${part.mimeType};base64,${base64}` },
                });
            }
        }

        const msg: Record<string, unknown> = {
            role: message.role,
            content:
                content.length === 1 && (content[0] as Record<string, unknown>).type === "text"
                    ? (content[0] as Record<string, string>).text
                    : content,
        };

        if (message.toolCallId) {
            msg.tool_call_id = message.toolCallId;
        }
        if (message.name) {
            msg.name = message.name;
        }

        return msg;
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
