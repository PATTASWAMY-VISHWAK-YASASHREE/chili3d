// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Utility functions for the RAG pipeline.
 */

/**
 * Estimate the number of tokens in a string.
 * Uses a simple heuristic: ~4 characters per token for English text.
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

/**
 * Chunk text into segments respecting paragraph and sentence boundaries.
 * Each chunk is at most `maxTokens` tokens, with `overlap` tokens of overlap.
 */
export function chunkText(text: string, options: { maxTokens: number; overlap: number }): string[] {
    if (!text) return [];

    const { maxTokens, overlap } = options;
    const maxChars = maxTokens * 4;
    const overlapChars = overlap * 4;

    // Split on paragraph boundaries first
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let current = "";

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        if (estimateTokens(current + "\n\n" + trimmed) <= maxTokens) {
            current = current ? `${current}\n\n${trimmed}` : trimmed;
        } else {
            if (current) {
                chunks.push(current);
            }

            // If a single paragraph exceeds maxTokens, split by sentences
            if (estimateTokens(trimmed) > maxTokens) {
                const sentences = trimmed.match(/[^.!?]+[.!?]+\s*/g) ?? [trimmed];
                let sentenceChunk = "";

                for (const sentence of sentences) {
                    if (estimateTokens(sentenceChunk + sentence) <= maxTokens) {
                        sentenceChunk += sentence;
                    } else {
                        if (sentenceChunk) {
                            chunks.push(sentenceChunk.trim());
                        }
                        // If a single sentence is too long, split by character limit
                        if (sentence.length > maxChars) {
                            for (let i = 0; i < sentence.length; i += maxChars - overlapChars) {
                                chunks.push(sentence.slice(i, i + maxChars).trim());
                            }
                            sentenceChunk = "";
                        } else {
                            sentenceChunk = sentence;
                        }
                    }
                }
                if (sentenceChunk) {
                    chunks.push(sentenceChunk.trim());
                }
                current = "";
            } else {
                current = trimmed;
            }
        }
    }

    if (current) {
        chunks.push(current);
    }

    return chunks.filter((c) => c.length > 0);
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal).
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
        throw new Error(`Vector dimensions mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
}
