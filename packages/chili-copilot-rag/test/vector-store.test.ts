// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { InMemoryVectorStore } from "../src/in-memory-vector-store";
import type { VectorDocument } from "../src/vector-store";

function createDoc(id: string, embedding: number[], content: string): VectorDocument {
    return {
        id,
        embedding: new Float32Array(embedding),
        content,
        metadata: { source: "scene_node", timestamp: Date.now() },
    };
}

describe("InMemoryVectorStore", () => {
    test("should start empty", () => {
        const store = new InMemoryVectorStore("test", 3);
        expect(store.count).toBe(0);
        expect(store.name).toBe("test");
        expect(store.dimensions).toBe(3);
    });

    test("should upsert documents", async () => {
        const store = new InMemoryVectorStore("test", 3);
        await store.upsert([createDoc("a", [1, 0, 0], "doc a"), createDoc("b", [0, 1, 0], "doc b")]);
        expect(store.count).toBe(2);
    });

    test("should overwrite existing documents on upsert", async () => {
        const store = new InMemoryVectorStore("test", 3);
        await store.upsert([createDoc("a", [1, 0, 0], "original")]);
        await store.upsert([createDoc("a", [1, 0, 0], "updated")]);
        expect(store.count).toBe(1);

        const results = await store.search(new Float32Array([1, 0, 0]), 1);
        expect(results[0].document.content).toBe("updated");
    });

    test("should reject documents with wrong dimensions", async () => {
        const store = new InMemoryVectorStore("test", 3);
        await expect(store.upsert([createDoc("a", [1, 0], "doc")])).rejects.toThrow(
            "Embedding dimensions mismatch",
        );
    });

    test("should remove documents", async () => {
        const store = new InMemoryVectorStore("test", 3);
        await store.upsert([createDoc("a", [1, 0, 0], "doc a")]);
        await store.remove(["a"]);
        expect(store.count).toBe(0);
    });

    test("should search by cosine similarity", async () => {
        const store = new InMemoryVectorStore("test", 3);
        await store.upsert([
            createDoc("a", [1, 0, 0], "x-axis"),
            createDoc("b", [0, 1, 0], "y-axis"),
            createDoc("c", [0, 0, 1], "z-axis"),
        ]);

        // Query close to x-axis should return "a" first
        const results = await store.search(new Float32Array([0.9, 0.1, 0]), 3);
        expect(results[0].document.id).toBe("a");
        expect(results[0].score).toBeGreaterThan(0.9);
    });

    test("should respect topK limit", async () => {
        const store = new InMemoryVectorStore("test", 3);
        await store.upsert([
            createDoc("a", [1, 0, 0], "a"),
            createDoc("b", [0, 1, 0], "b"),
            createDoc("c", [0, 0, 1], "c"),
        ]);

        const results = await store.search(new Float32Array([1, 1, 1]), 2);
        expect(results).toHaveLength(2);
    });

    test("should filter by source metadata", async () => {
        const store = new InMemoryVectorStore("test", 3);
        const docA = createDoc("a", [1, 0, 0], "scene node");
        const docB = {
            ...createDoc("b", [0.9, 0.1, 0], "user doc"),
            metadata: { source: "user_doc" as const, timestamp: Date.now() },
        };
        await store.upsert([docA, docB]);

        const results = await store.search(new Float32Array([1, 0, 0]), 10, {
            source: "scene_node",
        });
        expect(results).toHaveLength(1);
        expect(results[0].document.id).toBe("a");
    });

    test("should filter by nodeId metadata", async () => {
        const store = new InMemoryVectorStore("test", 3);
        const docA = createDoc("a", [1, 0, 0], "node1");
        docA.metadata.nodeId = "node-1";
        const docB = createDoc("b", [0.9, 0.1, 0], "node2");
        docB.metadata.nodeId = "node-2";
        await store.upsert([docA, docB]);

        const results = await store.search(new Float32Array([1, 0, 0]), 10, {
            nodeId: "node-1",
        });
        expect(results).toHaveLength(1);
        expect(results[0].document.id).toBe("a");
    });

    test("should clear all documents", async () => {
        const store = new InMemoryVectorStore("test", 3);
        await store.upsert([createDoc("a", [1, 0, 0], "a"), createDoc("b", [0, 1, 0], "b")]);
        await store.clear();
        expect(store.count).toBe(0);
    });

    test("should reject query with wrong dimensions", async () => {
        const store = new InMemoryVectorStore("test", 3);
        await expect(store.search(new Float32Array([1, 0]), 1)).rejects.toThrow("Query dimensions mismatch");
    });

    test("should dispose and clear", () => {
        const store = new InMemoryVectorStore("test", 3);
        store.dispose();
        expect(store.count).toBe(0);
    });
});
