// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import type { ILLMProvider } from "chili-copilot";
import { ContextAssembler } from "../src/context-assembler";
import { InMemoryVectorStore } from "../src/in-memory-vector-store";

function createMockProvider(): ILLMProvider {
    return {
        id: "mock",
        displayName: "Mock Provider",
        capabilities: {
            supportsVision: false,
            supportsStreaming: false,
            supportsFunctionCalling: false,
            maxContextTokens: 128_000,
            maxOutputTokens: 16_384,
            embeddingDimensions: 3,
        },
        chat: async function* () {},
        embedText: async (texts: string[]) => texts.map(() => new Float32Array([0.5, 0.5, 0.5])),
        dispose: () => {},
    };
}

describe("ContextAssembler", () => {
    test("should build context with system prompt and user query", async () => {
        const store = new InMemoryVectorStore("test", 3);
        const provider = createMockProvider();
        const assembler = new ContextAssembler(store, provider);

        const messages = await assembler.buildContext("Create a cube", [], "Scene is empty", 10000);

        expect(messages.length).toBeGreaterThanOrEqual(2);
        expect(messages[0].role).toBe("system");
        expect(messages[messages.length - 1].role).toBe("user");
    });

    test("should include scene context in user message", async () => {
        const store = new InMemoryVectorStore("test", 3);
        const provider = createMockProvider();
        const assembler = new ContextAssembler(store, provider);

        const messages = await assembler.buildContext(
            "Create a cube",
            [],
            "Scene: 1 object - Cylinder",
            10000,
        );

        const userMessage = messages[messages.length - 1];
        const textParts = userMessage.content.filter((c) => c.type === "text");
        const combined = textParts.map((c) => c.text).join(" ");
        expect(combined).toContain("Scene: 1 object - Cylinder");
    });

    test("should include conversation history when budget allows", async () => {
        const store = new InMemoryVectorStore("test", 3);
        const provider = createMockProvider();
        const assembler = new ContextAssembler(store, provider);

        const history = [
            {
                role: "user" as const,
                content: [{ type: "text" as const, text: "Make it bigger" }],
            },
            {
                role: "assistant" as const,
                content: [{ type: "text" as const, text: "I scaled it up" }],
            },
        ];

        const messages = await assembler.buildContext("Now add a cylinder", history, "", 10000);

        // System prompt + history messages + user message
        expect(messages.length).toBeGreaterThanOrEqual(4);
    });

    test("should use custom system prompt when provided", async () => {
        const store = new InMemoryVectorStore("test", 3);
        const provider = createMockProvider();
        const assembler = new ContextAssembler(store, provider);

        const messages = await assembler.buildContext(
            "Query",
            [],
            "",
            10000,
            "Custom system prompt for testing",
        );

        const systemText = messages[0].content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("");
        expect(systemText).toBe("Custom system prompt for testing");
    });

    test("should include RAG context when documents exist", async () => {
        const store = new InMemoryVectorStore("test", 3);
        await store.upsert([
            {
                id: "doc1",
                embedding: new Float32Array([0.5, 0.5, 0.5]),
                content: "CAD operation: extrude creates 3D from 2D sketch",
                metadata: { source: "api_doc", timestamp: Date.now() },
            },
        ]);

        const provider = createMockProvider();
        const assembler = new ContextAssembler(store, provider);

        const messages = await assembler.buildContext("How do I extrude?", [], "", 10000);

        const userMessage = messages[messages.length - 1];
        const combined = userMessage.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join(" ");
        expect(combined).toContain("extrude");
    });
});
