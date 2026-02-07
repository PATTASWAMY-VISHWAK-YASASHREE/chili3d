// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import style from "./reasoning-trace-panel.module.css";
import type { ReasoningEntry, ReasoningTrace } from "./types";

/**
 * Custom element that renders the reasoning trace of an AI conversation.
 * Shows thinking blocks, tool calls, plan steps, code, and messages.
 */
export class ReasoningTracePanel extends HTMLElement {
    private _trace: ReasoningTrace | undefined;
    private _autoScroll = true;
    private _container: HTMLDivElement;
    private _header: HTMLDivElement;

    constructor() {
        super();
        this._container = document.createElement("div");
        this._container.className = style.reasoningPanel;

        this._header = document.createElement("div");
        this._header.className = style.header;
        this._header.textContent = "Reasoning Trace";

        this._container.addEventListener("scroll", () => {
            const { scrollTop, scrollHeight, clientHeight } = this._container;
            this._autoScroll = scrollHeight - scrollTop - clientHeight < 50;
        });
    }

    connectedCallback(): void {
        this.appendChild(this._header);
        this.appendChild(this._container);
    }

    get trace(): ReasoningTrace | undefined {
        return this._trace;
    }

    set trace(value: ReasoningTrace | undefined) {
        this._trace = value;
        this.render();
    }

    render(): void {
        // Keep the header, clear entries
        while (this._container.children.length > 0) {
            this._container.removeChild(this._container.lastChild!);
        }

        if (!this._trace) return;

        this.updateHeader();

        for (const entry of this._trace.entries) {
            const el = this.renderEntry(entry);
            this._container.appendChild(el);
        }

        if (this._autoScroll) {
            this._container.scrollTop = this._container.scrollHeight;
        }
    }

    private updateHeader(): void {
        if (!this._trace) return;

        const status = this._trace.status;
        let indicatorClass = style.statusThinking;
        if (status === "complete") indicatorClass = style.statusComplete;
        else if (status === "error") indicatorClass = style.statusError;

        this._header.innerHTML = "";

        const indicator = document.createElement("span");
        indicator.className = `${style.statusIndicator} ${indicatorClass}`;
        this._header.appendChild(indicator);

        const label = document.createElement("span");
        label.textContent = `Reasoning — ${status}`;
        this._header.appendChild(label);
    }

    renderEntry(entry: ReasoningEntry): HTMLElement {
        const el = document.createElement("div");
        el.className = style.entry;

        switch (entry.type) {
            case "thinking":
                el.classList.add(style.thinking);
                el.textContent = entry.content;
                break;
            case "tool_call":
                el.classList.add(style.toolCall);
                el.innerHTML = this.renderToolCall(entry);
                break;
            case "plan_step":
                el.classList.add(style.planStep);
                el.innerHTML = this.renderPlanStep(entry);
                break;
            case "code":
                el.classList.add(style.code);
                el.textContent = entry.code;
                break;
            case "message":
                el.classList.add(style.message);
                el.textContent = entry.content;
                break;
        }

        return el;
    }

    private renderToolCall(entry: Extract<ReasoningEntry, { type: "tool_call" }>): string {
        const statusClass =
            entry.status === "pending"
                ? style.toolStatusPending
                : entry.status === "success"
                  ? style.toolStatusSuccess
                  : style.toolStatusError;
        const statusIcon = entry.status === "pending" ? "⏳" : entry.status === "success" ? "✓" : "✗";

        let html = `<span class="${style.toolName}">🔧 ${this.escapeHtml(entry.toolName)}</span>`;
        html += `<span class="${style.toolStatus} ${statusClass}">${statusIcon} ${entry.status}</span>`;

        if (entry.input) {
            html += `<div class="${style.toolDetails}">${this.escapeHtml(JSON.stringify(entry.input, null, 2))}</div>`;
        }
        if (entry.output) {
            html += `<div class="${style.toolDetails}">${this.escapeHtml(JSON.stringify(entry.output, null, 2))}</div>`;
        }

        return html;
    }

    private renderPlanStep(entry: Extract<ReasoningEntry, { type: "plan_step" }>): string {
        const icons: Record<string, string> = {
            pending: "☐",
            active: "▶",
            done: "☑",
            skipped: "⊘",
        };
        const icon = icons[entry.status] ?? "☐";
        return `<span class="${style.stepIcon}">${icon}</span><span>${entry.index + 1}. ${this.escapeHtml(entry.label)}</span>`;
    }

    private escapeHtml(text: string): string {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
}

customElements.define("copilot-reasoning-trace", ReasoningTracePanel);
