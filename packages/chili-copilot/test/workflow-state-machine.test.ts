// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { WorkflowStateMachine } from "../src/agentic/workflow-state-machine";

describe("WorkflowStateMachine", () => {
    test("should start in idle state", () => {
        const wf = new WorkflowStateMachine();
        expect(wf.phase).toBe("idle");
    });

    test("should transition from idle to analyzing", () => {
        const wf = new WorkflowStateMachine();
        wf.startAnalysis("Make a cube");
        expect(wf.phase).toBe("analyzing");
        expect((wf.state as { userPrompt: string }).userPrompt).toBe("Make a cube");
    });

    test("should transition from analyzing to clarifying", () => {
        const wf = new WorkflowStateMachine();
        wf.startAnalysis("Make a gun");
        wf.requestClarification([{ id: "q1", question: "Sci-fi style?", type: "boolean", required: true }]);
        expect(wf.phase).toBe("clarifying");
    });

    test("should store clarification answers", () => {
        const wf = new WorkflowStateMachine();
        wf.startAnalysis("Make a gun");
        wf.requestClarification([{ id: "q1", question: "Style?", type: "text", required: true }]);
        wf.answerQuestion("q1", "Sci-fi");

        const state = wf.state as { answers: Map<string, string> };
        expect(state.answers.get("q1")).toBe("Sci-fi");
    });

    test("should transition to awaiting_approval", () => {
        const wf = new WorkflowStateMachine();
        const plan = {
            id: "p1",
            title: "Test",
            description: "",
            constraints: {},
            steps: [],
            estimatedTokens: 1000,
            estimatedCostUsd: 0.01,
        };
        wf.awaitApproval(plan);
        expect(wf.phase).toBe("awaiting_approval");
    });

    test("should transition from awaiting_approval to executing", () => {
        const wf = new WorkflowStateMachine();
        const plan = {
            id: "p1",
            title: "Test",
            description: "",
            constraints: {},
            steps: [],
            estimatedTokens: 1000,
            estimatedCostUsd: 0.01,
        };
        wf.awaitApproval(plan);
        wf.startExecution(plan);
        expect(wf.phase).toBe("executing");
    });

    test("should transition to completed", () => {
        const wf = new WorkflowStateMachine();
        const plan = {
            id: "p1",
            title: "Test",
            description: "",
            constraints: {},
            steps: [],
            estimatedTokens: 1000,
            estimatedCostUsd: 0.01,
        };
        wf.complete(plan, []);
        expect(wf.phase).toBe("completed");
    });

    test("should transition to error", () => {
        const wf = new WorkflowStateMachine();
        wf.setError("Something failed", true);
        expect(wf.phase).toBe("error");
        expect((wf.state as { error: string }).error).toBe("Something failed");
        expect((wf.state as { recoverable: boolean }).recoverable).toBe(true);
    });

    test("should reset to idle", () => {
        const wf = new WorkflowStateMachine();
        wf.startAnalysis("test");
        wf.reset();
        expect(wf.phase).toBe("idle");
    });

    test("should throw on invalid transition from idle to clarifying", () => {
        const wf = new WorkflowStateMachine();
        expect(() => wf.requestClarification([])).toThrow("Invalid state transition");
    });

    test("should throw on invalid transition from idle to executing", () => {
        const wf = new WorkflowStateMachine();
        const plan = {
            id: "p1",
            title: "Test",
            description: "",
            constraints: {},
            steps: [],
            estimatedTokens: 1000,
            estimatedCostUsd: 0.01,
        };
        expect(() => wf.startExecution(plan)).toThrow("Invalid state transition");
    });

    test("should notify listeners on state change", () => {
        const wf = new WorkflowStateMachine();
        const states: string[] = [];
        wf.onStateChange((state) => states.push(state.phase));

        wf.startAnalysis("test");
        wf.reset();

        expect(states).toEqual(["analyzing", "idle"]);
    });

    test("should unsubscribe listener", () => {
        const wf = new WorkflowStateMachine();
        const states: string[] = [];
        const unsubscribe = wf.onStateChange((state) => states.push(state.phase));

        wf.startAnalysis("test");
        unsubscribe();
        wf.reset();

        expect(states).toEqual(["analyzing"]);
    });
});
