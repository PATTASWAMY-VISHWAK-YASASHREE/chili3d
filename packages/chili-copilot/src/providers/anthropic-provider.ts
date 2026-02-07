// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ChatChunk, ChatMessage, ChatRequest, LLMCapabilities } from "../provider";
import { BaseProvider } from "./base-provider";

/**
 * Anthropic provider adapter.
 * Supports Claude 3.5 Sonnet/Haiku with extended thinking and vision.
 */
export class AnthropicProvider extends BaseProvider {
    readonly id = "anthropic";
    readonly displayName: string;
    readonly capabilities: LLMCapabilities;
    private readonly modelName: string;

    constructor(
        apiKey: string,
        options?: {
            model?: string;
            baseUrl?: string;
        },
    ) {
        super(apiKey, options?.baseUrl ?? "https://api.anthropic.com/v1");
        this.modelName = options?.model ?? "claude-3-5-sonnet-20241022";
        this.displayName = this.modelName;
        this.capabilities = {
            supportsVision: true,
            supportsStreaming: true,
            supportsFunctionCalling: true,
            maxContextTokens: 200_000,
            maxOutputTokens: 8_192,
            embeddingDimensions: 0, // Anthropic does not provide embeddings
        };
    }

    async *chat(request: ChatRequest): AsyncIterable<ChatChunk> {
        const body = this.buildRequestBody(request);
        const response = await this.fetchWithRetry(`${this.baseUrl}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
            signal: request.signal,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${error}`);
        }

        for await (const data of this.parseSSEStream(response)) {
            const parsed = JSON.parse(data);
            const chunk: ChatChunk = { delta: "" };

            if (parsed.type === "content_block_delta") {
                if (parsed.delta?.type === "text_delta") {
                    chunk.delta = parsed.delta.text ?? "";
                } else if (parsed.delta?.type === "thinking_delta") {
                    chunk.thinking = parsed.delta.thinking ?? "";
                } else if (parsed.delta?.type === "input_json_delta") {
                    // Tool call input being streamed — accumulate
                    chunk.delta = "";
                }
            }

            if (parsed.type === "content_block_start" && parsed.content_block?.type === "tool_use") {
                chunk.toolCalls = [
                    {
                        id: parsed.content_block.id,
                        name: parsed.content_block.name,
                        input: {},
                    },
                ];
            }

            if (parsed.type === "message_delta" && parsed.usage) {
                chunk.usage = this.computeUsageCost(this.modelName, {
                    promptTokens: parsed.usage.input_tokens ?? 0,
                    completionTokens: parsed.usage.output_tokens ?? 0,
                    totalTokens: (parsed.usage.input_tokens ?? 0) + (parsed.usage.output_tokens ?? 0),
                    cachedTokens: parsed.usage.cache_read_input_tokens,
                });
                chunk.finishReason = parsed.delta?.stop_reason === "tool_use" ? "tool_use" : "stop";
            }

            yield chunk;
        }
    }

    async embedText(_texts: string[]): Promise<Float32Array[]> {
        throw new Error("Anthropic does not provide an embeddings API. Use OpenAI or Google for embeddings.");
    }

    private buildRequestBody(request: ChatRequest): Record<string, unknown> {
        const systemMessages = request.messages.filter((m) => m.role === "system");
        const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

        const body: Record<string, unknown> = {
            model: this.modelName,
            messages: nonSystemMessages.map((m) => this.convertMessage(m)),
            stream: true,
            max_tokens: request.maxTokens ?? this.capabilities.maxOutputTokens,
        };

        if (systemMessages.length > 0) {
            const systemText = systemMessages
                .flatMap((m) => m.content)
                .filter((c) => c.type === "text")
                .map((c) => c.text)
                .join("\n\n");
            body.system = systemText;
        }

        if (request.temperature !== undefined) {
            body.temperature = request.temperature;
        }
        if (request.tools && request.tools.length > 0) {
            body.tools = request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters,
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
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: part.mimeType,
                        data: base64,
                    },
                });
            } else if (part.type === "tool_result") {
                content.push({
                    type: "tool_result",
                    tool_use_id: part.toolUseId,
                    content: part.content,
                });
            }
        }

        return {
            role: message.role === "tool" ? "user" : message.role,
            content,
        };
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
