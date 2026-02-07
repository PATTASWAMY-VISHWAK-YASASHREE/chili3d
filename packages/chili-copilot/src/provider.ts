// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDisposable } from "chili-core";

/**
 * Unified interface for all LLM providers.
 * Each provider adapter implements this contract.
 */
export interface ILLMProvider extends IDisposable {
    readonly id: string;
    readonly displayName: string;
    readonly capabilities: LLMCapabilities;

    chat(request: ChatRequest): AsyncIterable<ChatChunk>;
    embedText(texts: string[]): Promise<Float32Array[]>;
}

export interface LLMCapabilities {
    supportsVision: boolean;
    supportsStreaming: boolean;
    supportsFunctionCalling: boolean;
    maxContextTokens: number;
    maxOutputTokens: number;
    embeddingDimensions: number;
}

export interface ChatRequest {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "text" | "json";
    signal?: AbortSignal;
}

export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: MessageContent[];
    toolCallId?: string;
    name?: string;
}

export type MessageContent =
    | { type: "text"; text: string }
    | { type: "image"; data: ArrayBuffer; mimeType: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
    | { type: "tool_result"; toolUseId: string; content: string };

export interface ChatChunk {
    delta: string;
    thinking?: string;
    toolCalls?: ToolCall[];
    usage?: TokenUsage;
    finishReason?: "stop" | "tool_use" | "length" | "content_filter";
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens?: number;
    costUsd?: number;
}

import type { ToolCall, ToolDefinition } from "./tools";
