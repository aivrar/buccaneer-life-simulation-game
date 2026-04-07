/**
 * Embedding Client — TEXT-ONLY MODE.
 *
 * Embeddings are disabled. All memory uses SQL-based recency + importance
 * ranking instead of semantic vector search. This avoids the embedding
 * table bloat that killed performance in RAVE LIFE (70K+ rows/day).
 *
 * The interface is preserved so code can be re-enabled later if needed.
 */

import type { EmbeddingRequest, EmbeddingResponse } from './types.js';

export class EmbeddingClient {
  /** TEXT-ONLY MODE — always returns null. */
  async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse | null> {
    return null;
  }

  /** TEXT-ONLY MODE — always returns null. */
  async embedSingle(_text: string): Promise<number[] | null> {
    return null;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
