// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ChatChunk } from "../provider";
import type { ToolExecutor } from "../tool-executor";

/**
 * Reasoning entry types used by the stream processor.
 */
export type StreamReasoningEntry =
    | { type: "thinking"; content: string }
    | {
          type: "tool_call";
          toolName: string;
          input: unknown;
          output?: unknown;
          status: "pending" | "success" | "error";
      }
    | { type: "message"; role: "assistant"; content: string };

/**
 * Trace object that accumulates entries from stream processing.
 */
export interface StreamTrace {
    entries: StreamReasoningEntry[];
}

/**
 * Processes the ChatChunk stream and routes content
 * to the appropriate entry in the trace.
 */
export class ReasoningStreamProcessor {
    constructor(
        private readonly trace: StreamTrace,
        private readonly toolExecutor: ToolExecutor,
    ) {}

    /**
     * Process a stream of ChatChunks, updating the reasoning trace
     * and executing tool calls.
     */
    async processStream(stream: AsyncIterable<ChatChunk>): Promise<void> {
        let currentThinking: Extract<StreamReasoningEntry, { type: "thinking" }> | undefined;
        let currentMessage: Extract<StreamReasoningEntry, { type: "message" }> | undefined;

        for await (const chunk of stream) {
            // Route thinking content to a "thinking" entry
            if (chunk.thinking) {
                if (!currentThinking) {
                    currentThinking = { type: "thinking", content: "" };
                    this.trace.entries.push(currentThinking);
                }
                currentThinking.content += chunk.thinking;
            }

            // Route main delta to the assistant message entry
            if (chunk.delta) {
                if (!currentMessage) {
                    currentMessage = { type: "message", role: "assistant", content: "" };
                    this.trace.entries.push(currentMessage);
                }
                currentMessage.content += chunk.delta;
            }

            // Handle tool calls — execute and feed result back
            if (chunk.toolCalls) {
                for (const call of chunk.toolCalls) {
                    const toolEntry: Extract<StreamReasoningEntry, { type: "tool_call" }> = {
                        type: "tool_call",
                        toolName: call.name,
                        input: call.input,
                        status: "pending",
                    };
                    this.trace.entries.push(toolEntry);

                    try {
                        const result = await this.toolExecutor.execute(call);
                        toolEntry.output = result.data;
                        toolEntry.status = result.success ? "success" : "error";
                    } catch (error) {
                        toolEntry.output = String(error);
                        toolEntry.status = "error";
                    }
                }
            }
        }
    }
}
