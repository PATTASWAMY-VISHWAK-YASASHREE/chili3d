// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import style from "./resource-hud.module.css";

/**
 * Resource HUD component for the statusbar.
 * Shows token usage, cost, active model, and session duration.
 */
export class ResourceHUD extends HTMLElement {
    private _modelName = "";
    private _promptTokens = 0;
    private _completionTokens = 0;
    private _maxContextTokens = 128_000;
    private _costUsd = 0;
    private _startTime = Date.now();

    constructor() {
        super();
        this.className = style.resourceHud;
    }

    connectedCallback(): void {
        this.render();
    }

    get modelName(): string {
        return this._modelName;
    }

    set modelName(value: string) {
        this._modelName = value;
        this.render();
    }

    get totalTokens(): number {
        return this._promptTokens + this._completionTokens;
    }

    get contextUtilizationPercent(): number {
        if (this._maxContextTokens === 0) return 0;
        return (this.totalTokens / this._maxContextTokens) * 100;
    }

    /**
     * Record token usage from a response.
     */
    recordUsage(promptTokens: number, completionTokens: number, costUsd: number): void {
        this._promptTokens += promptTokens;
        this._completionTokens += completionTokens;
        this._costUsd += costUsd;
        this.render();
    }

    /**
     * Set the maximum context window size.
     */
    setMaxContext(maxTokens: number): void {
        this._maxContextTokens = maxTokens;
        this.render();
    }

    /**
     * Reset all metrics for a new session.
     */
    resetSession(): void {
        this._promptTokens = 0;
        this._completionTokens = 0;
        this._costUsd = 0;
        this._startTime = Date.now();
        this.render();
    }

    render(): void {
        const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const duration = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;

        const tokenLabel = `${this.formatTokens(this.totalTokens)}/${this.formatTokens(this._maxContextTokens)}`;
        const pct = Math.min(this.contextUtilizationPercent, 100);

        this.innerHTML = `
            <span class="${style.modelName}">${this.escapeHtml(this._modelName || "No model")}</span>
            <span class="${style.tokenUsage}">
                Tokens: ${tokenLabel} (${pct.toFixed(1)}%)
                <span class="${style.tokenBar}">
                    <span class="${style.tokenBarFill}" style="width: ${pct}%"></span>
                </span>
            </span>
            <span class="${style.cost}">$${this._costUsd.toFixed(4)}</span>
            <span class="${style.duration}">${duration}</span>
        `;
    }

    private formatTokens(n: number): string {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
        return String(n);
    }

    private escapeHtml(text: string): string {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
}

customElements.define("copilot-resource-hud", ResourceHUD);
