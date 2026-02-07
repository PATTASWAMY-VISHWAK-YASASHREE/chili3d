// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { chunkText, cosineSimilarity, estimateTokens } from "../src/utils";

describe("estimateTokens", () => {
    test("should return 0 for empty string", () => {
        expect(estimateTokens("")).toBe(0);
    });

    test("should estimate tokens for short text", () => {
        // "hello" = 5 chars / 4 = 1.25 → ceil → 2
        expect(estimateTokens("hello")).toBe(2);
    });

    test("should estimate tokens for longer text", () => {
        const text = "This is a longer piece of text that should have more tokens.";
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(10);
    });
});

describe("chunkText", () => {
    test("should return empty array for empty text", () => {
        expect(chunkText("", { maxTokens: 100, overlap: 10 })).toEqual([]);
    });

    test("should return single chunk for short text", () => {
        const result = chunkText("Hello world", { maxTokens: 100, overlap: 10 });
        expect(result).toHaveLength(1);
        expect(result[0]).toBe("Hello world");
    });

    test("should split on paragraph boundaries", () => {
        const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
        // Each paragraph is ~4 tokens, with maxTokens=5 they should split
        const result = chunkText(text, { maxTokens: 5, overlap: 0 });
        expect(result.length).toBeGreaterThanOrEqual(2);
    });

    test("should keep paragraphs together when they fit", () => {
        const text = "Short.\n\nAlso short.";
        const result = chunkText(text, { maxTokens: 100, overlap: 0 });
        expect(result).toHaveLength(1);
    });

    test("should handle text without paragraph breaks", () => {
        const text = "A single long paragraph without any breaks that should still be processed.";
        const result = chunkText(text, { maxTokens: 100, overlap: 0 });
        expect(result.length).toBeGreaterThanOrEqual(1);
    });
});

describe("cosineSimilarity", () => {
    test("should return 1 for identical vectors", () => {
        const a = new Float32Array([1, 2, 3]);
        const b = new Float32Array([1, 2, 3]);
        expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
    });

    test("should return 0 for orthogonal vectors", () => {
        const a = new Float32Array([1, 0, 0]);
        const b = new Float32Array([0, 1, 0]);
        expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
    });

    test("should return -1 for opposite vectors", () => {
        const a = new Float32Array([1, 0, 0]);
        const b = new Float32Array([-1, 0, 0]);
        expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
    });

    test("should handle zero vectors", () => {
        const a = new Float32Array([0, 0, 0]);
        const b = new Float32Array([1, 2, 3]);
        expect(cosineSimilarity(a, b)).toBe(0);
    });

    test("should throw for mismatched dimensions", () => {
        const a = new Float32Array([1, 0]);
        const b = new Float32Array([1, 0, 0]);
        expect(() => cosineSimilarity(a, b)).toThrow("dimensions mismatch");
    });

    test("should compute correct similarity for non-trivial vectors", () => {
        const a = new Float32Array([1, 2, 3]);
        const b = new Float32Array([4, 5, 6]);
        // dot = 4+10+18 = 32, normA = sqrt(14), normB = sqrt(77)
        // expected = 32 / sqrt(14*77) ≈ 0.9746
        expect(cosineSimilarity(a, b)).toBeCloseTo(0.9746, 3);
    });
});
