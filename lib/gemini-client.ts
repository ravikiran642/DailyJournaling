import { GoogleGenAI, GenerateContentConfig } from '@google/genai';

/**
 * Resilient Model Fallback Ladder ordered by availability and latency (Directive 6):
 * 1. gemini-3.6-flash (Primary)
 * 2. gemini-3.1-flash-lite (High-Availability Fallback)
 * 3. gemini-flash-latest (Dynamic Alias)
 * 4. gemini-3.7-flash (Deep Reasoning Fallback)
 * 5. gemini-3.8-flash (Extended Fallback)
 */
export const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

/**
 * Resilient Embedding Model Fallback Ladder:
 * 1. gemini-embedding-2-preview (Primary)
 * 2. text-embedding-004 (High-Availability Fallback)
 */
export const EMBEDDING_MODELS_LADDER = [
  'gemini-embedding-2-preview',
  'text-embedding-004',
];

/**
 * Generate semantic embedding vector with automatic fallback ladder
 */
export async function generateEmbeddingWithFallback(text: string): Promise<{ values: number[]; modelUsed: string }> {
  const ai = getGenAI();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Cannot generate embedding for empty text.');
  }

  let lastError: any = null;

  for (const modelName of EMBEDDING_MODELS_LADDER) {
    try {
      const response = await ai.models.embedContent({
        model: modelName,
        contents: trimmed,
      });

      const values =
        response.embeddings?.[0]?.values ||
        (response as any).embedding?.values ||
        [];

      if (Array.isArray(values) && values.length > 0) {
        return {
          values,
          modelUsed: modelName,
        };
      }
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode || err?.code;
      const message = err?.message || String(err);

      console.warn(
        `[Gemini Embedding Fallback] Model '${modelName}' encountered an issue (Status: ${status || 'N/A'}): ${message}. Attempting next model in fallback ladder...`
      );
      continue;
    }
  }

  throw new Error(
    `All embedding models in fallback ladder failed. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Exact Vector Cosine Similarity computation:
 * dotProduct(A, B) / (||A|| * ||B||)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Derives the core semantic text representation for a journal entry
 * used for embeddings (prioritizing title, executive summary, tags, and key insights).
 */
export function getSemanticRepresentation(entry: {
  title?: string;
  summary?: string;
  initialPrompt?: string;
  tags?: string[];
  keyInsights?: string[];
}): string {
  const parts: string[] = [];
  if (entry.title && entry.title !== 'Untitled Reflection') {
    parts.push(`Title: ${entry.title}`);
  }
  if (entry.summary) {
    parts.push(`Summary: ${entry.summary}`);
  } else if (entry.initialPrompt) {
    parts.push(`Core thought: ${entry.initialPrompt}`);
  }
  if (entry.tags && entry.tags.length > 0) {
    parts.push(`Themes: ${entry.tags.join(', ')}`);
  }
  if (entry.keyInsights && entry.keyInsights.length > 0) {
    parts.push(`Key Takeaways: ${entry.keyInsights.join('; ')}`);
  }
  return parts.join('\n');
}

/**
 * Fast deterministic string hashing to detect when semantic text has changed
 */
export function computeSemanticHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Lazy initialization of GoogleGenAI SDK to prevent crash if key is missing during build
 */
let genAIInstance: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment.');
    }
    genAIInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIInstance;
}

/**
 * Execute Gemini content generation with automated fallback ladder
 */
export async function generateContentWithFallback({
  contents,
  config,
  preferredModel = 'gemini-3.6-flash',
}: {
  contents: any;
  config?: GenerateContentConfig;
  preferredModel?: string;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();

  // Create ordered model list with preferredModel first if in list
  const modelsToTry = [
    preferredModel,
    ...MODEL_FALLBACK_LADDER.filter((m) => m !== preferredModel),
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config,
      });

      const responseText = response.text || '';
      return {
        text: responseText,
        modelUsed: modelName,
      };
    } catch (err: any) {
      lastError = err;
      // Recoverable error: silently proceed to next model in fallback ladder
      continue;
    }
  }

  throw new Error(
    `All models in fallback ladder failed. Last error: ${lastError?.message || 'Unknown error'}`
  );
}
