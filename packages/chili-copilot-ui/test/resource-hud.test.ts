// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { ResourceHUD } from "../src/resource-hud";

describe("ResourceHUD", () => {
    test("should be defined as custom element", () => {
        const el = document.createElement("copilot-resource-hud");
        expect(el).toBeInstanceOf(ResourceHUD);
    });

    test("should start with zero tokens", () => {
        const hud = new ResourceHUD();
        expect(hud.totalTokens).toBe(0);
    });

    test("should track token usage", () => {
        const hud = new ResourceHUD();
        hud.recordUsage(1000, 500, 0.005);
        expect(hud.totalTokens).toBe(1500);
    });

    test("should accumulate multiple usages", () => {
        const hud = new ResourceHUD();
        hud.recordUsage(1000, 500, 0.005);
        hud.recordUsage(2000, 1000, 0.01);
        expect(hud.totalTokens).toBe(4500);
    });

    test("should calculate context utilization", () => {
        const hud = new ResourceHUD();
        hud.setMaxContext(100_000);
        hud.recordUsage(5000, 5000, 0.01);
        expect(hud.contextUtilizationPercent).toBe(10);
    });

    test("should render with model name", () => {
        const hud = new ResourceHUD();
        document.body.appendChild(hud);

        hud.modelName = "GPT-4o";
        hud.render();

        expect(hud.innerHTML).toContain("GPT-4o");
        document.body.removeChild(hud);
    });

    test("should render token counts", () => {
        const hud = new ResourceHUD();
        document.body.appendChild(hud);

        hud.recordUsage(5000, 3000, 0.05);

        expect(hud.innerHTML).toContain("8.0k");
        document.body.removeChild(hud);
    });

    test("should render cost", () => {
        const hud = new ResourceHUD();
        document.body.appendChild(hud);

        hud.recordUsage(0, 0, 0.0325);

        expect(hud.innerHTML).toContain("$0.0325");
        document.body.removeChild(hud);
    });

    test("should reset session", () => {
        const hud = new ResourceHUD();
        hud.recordUsage(5000, 3000, 0.05);
        hud.resetSession();
        expect(hud.totalTokens).toBe(0);
    });

    test("should handle zero max context", () => {
        const hud = new ResourceHUD();
        hud.setMaxContext(0);
        expect(hud.contextUtilizationPercent).toBe(0);
    });
});
