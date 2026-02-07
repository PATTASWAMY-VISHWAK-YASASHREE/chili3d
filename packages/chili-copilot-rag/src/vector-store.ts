// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDisposable } from "chili-core";

/**
 * In-browser vector store interface for RAG pipeline.
 * Implementations may use IndexedDB or in-memory storage.
 */
export interface IVectorStore extends IDisposable {
    readonly name: string;
    readonly dimensions: number;
    readonly count: number;

    upsert(documents: VectorDocument[]): Promise<void>;
    remove(ids: string[]): Promise<void>;
    search(query: Float32Array, topK: number, filter?: MetadataFilter): Promise<SearchResult[]>;
    clear(): Promise<void>;
}

export interface VectorDocument {
    id: string;
    embedding: Float32Array;
    content: string;
    metadata: DocumentMetadata;
}

export interface DocumentMetadata {
    source: "scene_node" | "user_doc" | "api_doc" | "conversation";
    nodeId?: string;
    filePath?: string;
    chunkIndex?: number;
    timestamp: number;
}

export interface SearchResult {
    document: VectorDocument;
    score: number;
}

export type MetadataFilter = {
    source?: DocumentMetadata["source"];
    nodeId?: string;
};
