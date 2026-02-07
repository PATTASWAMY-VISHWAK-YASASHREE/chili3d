// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { PlanApprovalPanel } from "../src/plan-approval-panel";
import type { Plan } from "../src/types";

function createTestPlan(): Plan {
    return {
        id: "plan-1",
        title: "Create a Box",
        description: "A simple box primitive",
        constraints: { size: "10x10x10mm", material: "Steel" },
        steps: [
            {
                index: 0,
                label: "Create sketch",
                description: "Create a rectangular sketch on XY plane",
                dependsOn: [],
                toolHints: ["create_sketch"],
                status: "pending",
            },
            {
                index: 1,
                label: "Extrude",
                description: "Extrude the sketch 10mm",
                dependsOn: [0],
                toolHints: ["extrude"],
                status: "pending",
            },
        ],
        estimatedTokens: 5000,
        estimatedCostUsd: 0.02,
    };
}

describe("PlanApprovalPanel", () => {
    test("should be defined as custom element", () => {
        const el = document.createElement("copilot-plan-approval");
        expect(el).toBeInstanceOf(PlanApprovalPanel);
    });

    test("should render plan title", () => {
        const panel = new PlanApprovalPanel();
        document.body.appendChild(panel);

        panel.plan = createTestPlan();

        expect(panel.innerHTML).toContain("Create a Box");
        document.body.removeChild(panel);
    });

    test("should render plan steps", () => {
        const panel = new PlanApprovalPanel();
        document.body.appendChild(panel);

        panel.plan = createTestPlan();

        expect(panel.innerHTML).toContain("Create sketch");
        expect(panel.innerHTML).toContain("Extrude");
        document.body.removeChild(panel);
    });

    test("should render constraints", () => {
        const panel = new PlanApprovalPanel();
        document.body.appendChild(panel);

        panel.plan = createTestPlan();

        expect(panel.innerHTML).toContain("10x10x10mm");
        expect(panel.innerHTML).toContain("Steel");
        document.body.removeChild(panel);
    });

    test("should render cost estimate", () => {
        const panel = new PlanApprovalPanel();
        document.body.appendChild(panel);

        panel.plan = createTestPlan();

        expect(panel.innerHTML).toContain("$0.02");
        document.body.removeChild(panel);
    });

    test("should render action buttons", () => {
        const panel = new PlanApprovalPanel();
        document.body.appendChild(panel);

        panel.plan = createTestPlan();

        const buttons = panel.querySelectorAll("button");
        expect(buttons.length).toBe(3);
        document.body.removeChild(panel);
    });

    test("should call onResult with approve", () => {
        const panel = new PlanApprovalPanel();
        document.body.appendChild(panel);

        let result: string | undefined;
        panel.onResult((r) => {
            result = r;
        });
        panel.plan = createTestPlan();

        const approveBtn = panel.querySelector("button");
        approveBtn?.click();

        expect(result).toBe("approve");
        document.body.removeChild(panel);
    });

    test("should render empty when no plan set", () => {
        const panel = new PlanApprovalPanel();
        document.body.appendChild(panel);

        panel.plan = undefined;

        expect(panel.innerHTML).toBe("");
        document.body.removeChild(panel);
    });
});
