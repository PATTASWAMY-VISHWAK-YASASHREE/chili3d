// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { computeCost, MODEL_PRICING } from "../src/pricing";

describe("MODEL_PRICING", () => {
    test("should contain all expected models", () => {
        const expectedModels = [
            "gpt-4o",
            "gpt-4o-mini",
            "claude-3.5-sonnet",
            "claude-3.5-haiku",
            "gemini-2.0-flash",
            "gemini-2.0-pro",
        ];

        for (const model of expectedModels) {
            expect(MODEL_PRICING[model]).toBeDefined();
            expect(MODEL_PRICING[model].input).toBeGreaterThan(0);
            expect(MODEL_PRICING[model].output).toBeGreaterThan(0);
        }
    });

    test("should have cachedInput pricing for OpenAI and Anthropic models", () => {
        expect(MODEL_PRICING["gpt-4o"].cachedInput).toBeDefined();
        expect(MODEL_PRICING["gpt-4o-mini"].cachedInput).toBeDefined();
        expect(MODEL_PRICING["claude-3.5-sonnet"].cachedInput).toBeDefined();
        expect(MODEL_PRICING["claude-3.5-haiku"].cachedInput).toBeDefined();
    });
});

describe("computeCost", () => {
    test("should compute cost for gpt-4o", () => {
        // 1000 prompt tokens at $2.50/1M = $0.0025
        // 500 completion tokens at $10.00/1M = $0.005
        const cost = computeCost("gpt-4o", 1000, 500);
        expect(cost).toBeCloseTo(0.0075, 6);
    });

    test("should account for cached tokens", () => {
        // 800 non-cached prompt at $2.50/1M + 200 cached at $1.25/1M
        // = $0.002 + $0.00025 = $0.00225
        // 500 completion at $10.00/1M = $0.005
        const cost = computeCost("gpt-4o", 1000, 500, 200);
        expect(cost).toBeCloseTo(0.00725, 6);
    });

    test("should return 0 for unknown model", () => {
        const cost = computeCost("unknown-model", 1000, 500);
        expect(cost).toBe(0);
    });

    test("should compute cost for gemini-2.0-flash", () => {
        // 10000 prompt at $0.10/1M = $0.001
        // 5000 completion at $0.40/1M = $0.002
        const cost = computeCost("gemini-2.0-flash", 10000, 5000);
        expect(cost).toBeCloseTo(0.003, 6);
    });

    test("should handle zero tokens", () => {
        const cost = computeCost("gpt-4o", 0, 0);
        expect(cost).toBe(0);
    });
});
