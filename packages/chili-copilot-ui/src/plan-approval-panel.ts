// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import style from "./plan-approval-panel.module.css";
import type { Plan } from "./types";

export type PlanApprovalResult = "approve" | "edit" | "reject";

/**
 * Custom element that renders a plan for user review.
 * Provides Approve / Edit / Reject actions.
 */
export class PlanApprovalPanel extends HTMLElement {
    private _plan: Plan | undefined;
    private _onResult: ((result: PlanApprovalResult) => void) | undefined;

    constructor() {
        super();
        this.className = style.planPanel;
    }

    connectedCallback(): void {
        this.render();
    }

    get plan(): Plan | undefined {
        return this._plan;
    }

    set plan(value: Plan | undefined) {
        this._plan = value;
        this.render();
    }

    /**
     * Set a callback for when the user takes an action.
     */
    onResult(callback: (result: PlanApprovalResult) => void): void {
        this._onResult = callback;
    }

    render(): void {
        this.innerHTML = "";
        if (!this._plan) return;

        const plan = this._plan;

        // Title
        const title = document.createElement("div");
        title.className = style.planTitle;
        title.textContent = `Plan: ${plan.title}`;
        this.appendChild(title);

        // Description
        if (plan.description) {
            const desc = document.createElement("div");
            desc.className = style.planDescription;
            desc.textContent = plan.description;
            this.appendChild(desc);
        }

        // Constraints
        const constraintKeys = Object.keys(plan.constraints);
        if (constraintKeys.length > 0) {
            const constraintsSection = document.createElement("div");
            constraintsSection.className = style.constraints;

            const label = document.createElement("div");
            label.className = style.constraintLabel;
            label.textContent = "Constraints:";
            constraintsSection.appendChild(label);

            for (const [key, value] of Object.entries(plan.constraints)) {
                const item = document.createElement("div");
                item.className = style.constraintItem;
                item.textContent = `${key}: ${value}`;
                constraintsSection.appendChild(item);
            }
            this.appendChild(constraintsSection);
        }

        // Steps
        const stepList = document.createElement("ol");
        stepList.className = style.stepList;
        for (const step of plan.steps) {
            const li = document.createElement("li");
            li.className = style.stepItem;

            const icon = document.createElement("span");
            icon.className = style.stepIcon;
            icon.textContent = step.status === "done" ? "☑" : "☐";
            li.appendChild(icon);

            const text = document.createElement("span");
            text.textContent = step.label;
            li.appendChild(text);

            stepList.appendChild(li);
        }
        this.appendChild(stepList);

        // Estimates
        const estimates = document.createElement("div");
        estimates.className = style.estimates;
        estimates.textContent = `Est. tokens: ~${plan.estimatedTokens.toLocaleString()}  Cost: ~$${plan.estimatedCostUsd.toFixed(2)}`;
        this.appendChild(estimates);

        // Action buttons
        const actions = document.createElement("div");
        actions.className = style.actions;

        const approveBtn = document.createElement("button");
        approveBtn.className = style.btnApprove;
        approveBtn.textContent = "✓ Approve";
        approveBtn.addEventListener("click", () => this._onResult?.("approve"));

        const editBtn = document.createElement("button");
        editBtn.className = style.btnEdit;
        editBtn.textContent = "✏ Edit";
        editBtn.addEventListener("click", () => this._onResult?.("edit"));

        const rejectBtn = document.createElement("button");
        rejectBtn.className = style.btnReject;
        rejectBtn.textContent = "✗ Reject";
        rejectBtn.addEventListener("click", () => this._onResult?.("reject"));

        actions.appendChild(approveBtn);
        actions.appendChild(editBtn);
        actions.appendChild(rejectBtn);
        this.appendChild(actions);
    }
}

customElements.define("copilot-plan-approval", PlanApprovalPanel);
