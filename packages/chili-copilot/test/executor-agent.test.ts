// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { ExecutorAgent } from "../src/agentic/executor-agent";
import type { PlanStep } from "../src/agentic/types";

describe("ExecutorAgent.topologicalSort", () => {
    // We test topologicalSort as a standalone method since executePlan requires a real LLM

    function createExecutor(): ExecutorAgent {
        const mockProvider = {
            id: "mock",
            displayName: "Mock",
            capabilities: {
                supportsVision: false,
                supportsStreaming: false,
                supportsFunctionCalling: false,
                maxContextTokens: 1000,
                maxOutputTokens: 1000,
                embeddingDimensions: 0,
            },
            chat: async function* () {},
            embedText: async () => [],
            dispose: () => {},
        };

        const { ToolExecutor } = require("../src/tool-executor");
        return new ExecutorAgent(mockProvider, new ToolExecutor());
    }

    test("should sort steps with no dependencies", () => {
        const executor = createExecutor();
        const steps: PlanStep[] = [
            { index: 0, label: "A", description: "", dependsOn: [], toolHints: [], status: "pending" },
            { index: 1, label: "B", description: "", dependsOn: [], toolHints: [], status: "pending" },
            { index: 2, label: "C", description: "", dependsOn: [], toolHints: [], status: "pending" },
        ];

        const sorted = executor.topologicalSort(steps);
        expect(sorted).toHaveLength(3);
    });

    test("should sort linear dependencies", () => {
        const executor = createExecutor();
        const steps: PlanStep[] = [
            { index: 0, label: "A", description: "", dependsOn: [], toolHints: [], status: "pending" },
            { index: 1, label: "B", description: "", dependsOn: [0], toolHints: [], status: "pending" },
            { index: 2, label: "C", description: "", dependsOn: [1], toolHints: [], status: "pending" },
        ];

        const sorted = executor.topologicalSort(steps);
        const indices = sorted.map((s) => s.index);
        expect(indices.indexOf(0)).toBeLessThan(indices.indexOf(1));
        expect(indices.indexOf(1)).toBeLessThan(indices.indexOf(2));
    });

    test("should sort diamond dependency graph", () => {
        const executor = createExecutor();
        const steps: PlanStep[] = [
            { index: 0, label: "A", description: "", dependsOn: [], toolHints: [], status: "pending" },
            { index: 1, label: "B", description: "", dependsOn: [0], toolHints: [], status: "pending" },
            { index: 2, label: "C", description: "", dependsOn: [0], toolHints: [], status: "pending" },
            { index: 3, label: "D", description: "", dependsOn: [1, 2], toolHints: [], status: "pending" },
        ];

        const sorted = executor.topologicalSort(steps);
        const indices = sorted.map((s) => s.index);

        // A must come before B and C
        expect(indices.indexOf(0)).toBeLessThan(indices.indexOf(1));
        expect(indices.indexOf(0)).toBeLessThan(indices.indexOf(2));
        // B and C must come before D
        expect(indices.indexOf(1)).toBeLessThan(indices.indexOf(3));
        expect(indices.indexOf(2)).toBeLessThan(indices.indexOf(3));
    });

    test("should handle empty steps", () => {
        const executor = createExecutor();
        const sorted = executor.topologicalSort([]);
        expect(sorted).toHaveLength(0);
    });

    test("should handle single step", () => {
        const executor = createExecutor();
        const steps: PlanStep[] = [
            { index: 0, label: "A", description: "", dependsOn: [], toolHints: [], status: "pending" },
        ];
        const sorted = executor.topologicalSort(steps);
        expect(sorted).toHaveLength(1);
        expect(sorted[0].label).toBe("A");
    });
});
