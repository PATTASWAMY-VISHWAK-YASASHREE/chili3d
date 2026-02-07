// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ILLMProvider } from "chili-copilot";
import { chunkText } from "./utils";
import type { IVectorStore, VectorDocument } from "./vector-store";

/**
 * Indexes different content sources into the vector store.
 * Handles scene graph nodes and user documents.
 */
export class IndexingPipeline {
    constructor(
        private readonly store: IVectorStore,
        private readonly provider: ILLMProvider,
    ) {}

    /**
     * Index an array of content items with their metadata.
     */
    async indexContent(
        items: Array<{
            id: string;
            content: string;
            source: "scene_node" | "user_doc" | "api_doc" | "conversation";
            nodeId?: string;
            filePath?: string;
        }>,
    ): Promise<void> {
        if (items.length === 0) return;

        const contents = items.map((item) => item.content);
        const embeddings = await this.provider.embedText(contents);

        const documents: VectorDocument[] = items.map((item, i) => ({
            id: item.id,
            embedding: embeddings[i],
            content: item.content,
            metadata: {
                source: item.source,
                nodeId: item.nodeId,
                filePath: item.filePath,
                timestamp: Date.now(),
            },
        }));

        await this.store.upsert(documents);
    }

    /**
     * Index a text document by chunking and embedding.
     */
    async indexDocument(
        docId: string,
        text: string,
        source: "user_doc" | "api_doc",
        filePath?: string,
    ): Promise<void> {
        const chunks = chunkText(text, { maxTokens: 512, overlap: 64 });
        if (chunks.length === 0) return;

        const embeddings = await this.provider.embedText(chunks);

        const documents: VectorDocument[] = chunks.map((chunk, i) => ({
            id: `${docId}:chunk:${i}`,
            embedding: embeddings[i],
            content: chunk,
            metadata: {
                source,
                filePath,
                chunkIndex: i,
                timestamp: Date.now(),
            },
        }));

        await this.store.upsert(documents);
    }

    /**
     * Remove all indexed content for a given ID prefix.
     */
    async removeByPrefix(prefix: string): Promise<void> {
        // Note: In a full implementation, we'd query by prefix.
        // For now, this is a placeholder that implementations can optimize.
        await this.store.remove([prefix]);
    }
}
