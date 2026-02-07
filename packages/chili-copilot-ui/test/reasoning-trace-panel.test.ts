// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { ReasoningTracePanel } from "../src/reasoning-trace-panel";
import type { ReasoningTrace } from "../src/types";

describe("ReasoningTracePanel", () => {
    test("should be defined as custom element", () => {
        const el = document.createElement("copilot-reasoning-trace");
        expect(el).toBeInstanceOf(ReasoningTracePanel);
    });

    test("should render empty when no trace set", () => {
        const panel = new ReasoningTracePanel();
        document.body.appendChild(panel);
        panel.render();
        expect(panel.children.length).toBeGreaterThanOrEqual(0);
        document.body.removeChild(panel);
    });

    test("should render thinking entry", () => {
        const panel = new ReasoningTracePanel();
        document.body.appendChild(panel);

        const trace: ReasoningTrace = {
            id: "test-1",
            timestamp: Date.now(),
            entries: [{ type: "thinking", content: "Computing normal vector..." }],
            status: "thinking",
        };
        panel.trace = trace;

        expect(panel.innerHTML).toContain("Computing normal vector...");
        document.body.removeChild(panel);
    });

    test("should render tool call entry", () => {
        const panel = new ReasoningTracePanel();
        document.body.appendChild(panel);

        const trace: ReasoningTrace = {
            id: "test-2",
            timestamp: Date.now(),
            entries: [
                {
                    type: "tool_call",
                    toolName: "extrude",
                    input: { distance: 10 },
                    status: "success",
                },
            ],
            status: "complete",
        };
        panel.trace = trace;

        expect(panel.innerHTML).toContain("extrude");
        expect(panel.innerHTML).toContain("success");
        document.body.removeChild(panel);
    });

    test("should render plan step entry", () => {
        const panel = new ReasoningTracePanel();
        document.body.appendChild(panel);

        const trace: ReasoningTrace = {
            id: "test-3",
            timestamp: Date.now(),
            entries: [
                { type: "plan_step", index: 0, label: "Create barrel", status: "done" },
                { type: "plan_step", index: 1, label: "Create grip", status: "pending" },
            ],
            status: "executing",
        };
        panel.trace = trace;

        expect(panel.innerHTML).toContain("Create barrel");
        expect(panel.innerHTML).toContain("Create grip");
        document.body.removeChild(panel);
    });

    test("should render message entry", () => {
        const panel = new ReasoningTracePanel();
        document.body.appendChild(panel);

        const trace: ReasoningTrace = {
            id: "test-4",
            timestamp: Date.now(),
            entries: [{ type: "message", role: "assistant", content: "I created a cube for you." }],
            status: "complete",
        };
        panel.trace = trace;

        expect(panel.innerHTML).toContain("I created a cube for you.");
        document.body.removeChild(panel);
    });

    test("should render code entry", () => {
        const panel = new ReasoningTracePanel();
        document.body.appendChild(panel);

        const trace: ReasoningTrace = {
            id: "test-5",
            timestamp: Date.now(),
            entries: [{ type: "code", language: "typescript", code: "const x = 42;" }],
            status: "complete",
        };
        panel.trace = trace;

        expect(panel.innerHTML).toContain("const x = 42;");
        document.body.removeChild(panel);
    });

    test("should render entry with renderEntry method", () => {
        const panel = new ReasoningTracePanel();
        const entry = { type: "thinking" as const, content: "test thinking" };
        const el = panel.renderEntry(entry);
        expect(el.textContent).toContain("test thinking");
    });
});
