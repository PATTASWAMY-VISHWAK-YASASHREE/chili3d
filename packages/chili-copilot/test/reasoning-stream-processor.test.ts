// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import type { StreamTrace } from "../src/agentic/reasoning-stream-processor";
import { ReasoningStreamProcessor } from "../src/agentic/reasoning-stream-processor";
import type { ChatChunk } from "../src/provider";
import { ToolExecutor } from "../src/tool-executor";

async function* mockStream(chunks: ChatChunk[]): AsyncIterable<ChatChunk> {
    for (const chunk of chunks) {
        yield chunk;
    }
}

describe("ReasoningStreamProcessor", () => {
    test("should accumulate thinking content", async () => {
        const trace: StreamTrace = { entries: [] };
        const executor = new ToolExecutor();
        const processor = new ReasoningStreamProcessor(trace, executor);

        await processor.processStream(
            mockStream([
                { delta: "", thinking: "Analyzing the" },
                { delta: "", thinking: " request..." },
            ]),
        );

        expect(trace.entries).toHaveLength(1);
        expect(trace.entries[0].type).toBe("thinking");
        expect((trace.entries[0] as { content: string }).content).toBe("Analyzing the request...");
    });

    test("should accumulate message delta", async () => {
        const trace: StreamTrace = { entries: [] };
        const executor = new ToolExecutor();
        const processor = new ReasoningStreamProcessor(trace, executor);

        await processor.processStream(mockStream([{ delta: "Hello, " }, { delta: "I can help!" }]));

        expect(trace.entries).toHaveLength(1);
        expect(trace.entries[0].type).toBe("message");
        expect((trace.entries[0] as { content: string }).content).toBe("Hello, I can help!");
    });

    test("should process tool calls", async () => {
        const trace: StreamTrace = { entries: [] };
        const executor = new ToolExecutor();
        executor.registerHandler("test_tool", {
            schema: { type: "object", properties: {} },
            execute: async () => ({ result: "ok" }),
        });

        const processor = new ReasoningStreamProcessor(trace, executor);

        await processor.processStream(
            mockStream([
                {
                    delta: "",
                    toolCalls: [{ id: "call_1", name: "test_tool", input: {} }],
                },
            ]),
        );

        expect(trace.entries).toHaveLength(1);
        expect(trace.entries[0].type).toBe("tool_call");
        const toolEntry = trace.entries[0] as { status: string; output: unknown };
        expect(toolEntry.status).toBe("success");
        expect(toolEntry.output).toEqual({ result: "ok" });
    });

    test("should handle tool call errors", async () => {
        const trace: StreamTrace = { entries: [] };
        const executor = new ToolExecutor();
        // No handler registered for "unknown_tool"

        const processor = new ReasoningStreamProcessor(trace, executor);

        await processor.processStream(
            mockStream([
                {
                    delta: "",
                    toolCalls: [{ id: "call_1", name: "unknown_tool", input: {} }],
                },
            ]),
        );

        expect(trace.entries).toHaveLength(1);
        const toolEntry = trace.entries[0] as { status: string };
        expect(toolEntry.status).toBe("error");
    });

    test("should handle mixed thinking, message, and tool calls", async () => {
        const trace: StreamTrace = { entries: [] };
        const executor = new ToolExecutor();
        executor.registerHandler("query", {
            schema: { type: "object", properties: {} },
            execute: async () => ({ nodes: [] }),
        });

        const processor = new ReasoningStreamProcessor(trace, executor);

        await processor.processStream(
            mockStream([
                { delta: "", thinking: "Let me think..." },
                { delta: "I'll check the scene." },
                {
                    delta: "",
                    toolCalls: [{ id: "call_1", name: "query", input: {} }],
                },
                { delta: " Done!" },
            ]),
        );

        expect(trace.entries.length).toBeGreaterThanOrEqual(3);
        const types = trace.entries.map((e) => e.type);
        expect(types).toContain("thinking");
        expect(types).toContain("message");
        expect(types).toContain("tool_call");
    });
});
