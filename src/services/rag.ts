import { DocumentChunk } from '../types';

// Simple text chunking function
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}

// Simple cosine similarity calculation
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Simple embedding generation using a basic hash-based approach
// In production, you'd use a proper embedding API
export async function generateEmbedding(text: string): Promise<number[]> {
  // This is a simple hash-based embedding for demo purposes
  // In production, use OpenAI embeddings, Cohere, or similar
  const hash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(128).fill(0);

  words.forEach((word, idx) => {
    const hashValue = hash(word);
    embedding[hashValue % embedding.length] += 1 / (idx + 1);
  });

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
}

// Retrieve relevant chunks based on query
export async function retrieveRelevantChunks(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 5
): Promise<DocumentChunk[]> {
  const queryEmbedding = await generateEmbedding(query);

  const scoredChunks = await Promise.all(
    chunks.map(async (chunk) => {
      if (!chunk.embedding) {
        chunk.embedding = await generateEmbedding(chunk.content);
      }
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      return { chunk, similarity };
    })
  );

  scoredChunks.sort((a, b) => b.similarity - a.similarity);
  return scoredChunks.slice(0, topK).map(item => item.chunk);
}

// Process file and create chunks
export async function processFile(file: File): Promise<DocumentChunk[]> {
  const text = await file.text();
  const chunks = chunkText(text);
  
  const documentChunks: DocumentChunk[] = await Promise.all(
    chunks.map(async (chunkText, index) => {
      const embedding = await generateEmbedding(chunkText);
      return {
        id: `${file.name}-${index}-${Date.now()}`,
        content: chunkText,
        metadata: {
          fileName: file.name,
          chunkIndex: index,
          timestamp: Date.now(),
        },
        embedding,
      };
    })
  );

  return documentChunks;
}
