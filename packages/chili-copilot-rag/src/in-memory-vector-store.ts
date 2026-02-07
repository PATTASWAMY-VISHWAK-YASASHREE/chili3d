// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { cosineSimilarity } from "./utils";
import type { IVectorStore, MetadataFilter, SearchResult, VectorDocument } from "./vector-store";

/**
 * In-memory vector store implementation.
 * Suitable for development, testing, and small datasets.
 * For production with persistence, use IndexedDBVectorStore.
 */
export class InMemoryVectorStore implements IVectorStore {
    private readonly _documents = new Map<string, VectorDocument>();
    readonly name: string;
    readonly dimensions: number;

    constructor(name: string, dimensions: number) {
        this.name = name;
        this.dimensions = dimensions;
    }

    get count(): number {
        return this._documents.size;
    }

    async upsert(documents: VectorDocument[]): Promise<void> {
        for (const doc of documents) {
            if (doc.embedding.length !== this.dimensions) {
                throw new Error(
                    `Embedding dimensions mismatch: expected ${this.dimensions}, got ${doc.embedding.length}`,
                );
            }
            this._documents.set(doc.id, doc);
        }
    }

    async remove(ids: string[]): Promise<void> {
        for (const id of ids) {
            this._documents.delete(id);
        }
    }

    async search(query: Float32Array, topK: number, filter?: MetadataFilter): Promise<SearchResult[]> {
        if (query.length !== this.dimensions) {
            throw new Error(`Query dimensions mismatch: expected ${this.dimensions}, got ${query.length}`);
        }

        const results: SearchResult[] = [];

        for (const doc of this._documents.values()) {
            if (filter) {
                if (filter.source && doc.metadata.source !== filter.source) continue;
                if (filter.nodeId && doc.metadata.nodeId !== filter.nodeId) continue;
            }

            const score = cosineSimilarity(query, doc.embedding);
            results.push({ document: doc, score });
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }

    async clear(): Promise<void> {
        this._documents.clear();
    }

    dispose(): void {
        this._documents.clear();
    }
}
