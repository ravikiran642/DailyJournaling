import { JournalEntry } from './types';
import { updateEntryEmbedding } from './firestore-service';
import { getSemanticRepresentation, computeSemanticHash } from './gemini-client';

/**
 * Checks if a journal entry needs a new or updated vector embedding.
 * Only mature entries (with summary, initial prompt > 30 chars, or multiple messages) are embedded.
 */
export function shouldEmbedEntry(entry: JournalEntry): boolean {
  if (!entry) return false;
  // If entry has a summary or key insights, it is definitely mature
  if (entry.summary && entry.summary.trim().length > 10) return true;
  // If entry has 2 or more messages, it has reached substantive reflection depth
  if (entry.messages && entry.messages.length >= 2) return true;
  // If initial prompt is substantive
  if (entry.initialPrompt && entry.initialPrompt.trim().length > 30) return true;
  return false;
}

/**
 * Generates and saves embedding for a single journal entry if needed.
 */
export async function syncEntryEmbedding(
  userId: string,
  entry: JournalEntry
): Promise<boolean> {
  try {
    if (!userId || !entry || !shouldEmbedEntry(entry)) {
      return false;
    }

    const semanticText = getSemanticRepresentation(entry);
    if (!semanticText || semanticText.trim().length < 15) {
      return false;
    }

    const currentHash = computeSemanticHash(semanticText);

    // If embedding already exists and the hash matches, no need to re-embed
    if (
      Array.isArray(entry.embedding) &&
      entry.embedding.length > 0 &&
      entry.embeddingSourceHash === currentHash
    ) {
      return false;
    }

    const res = await fetch('/api/gemini/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: semanticText }),
    });

    if (!res.ok) {
      console.warn('[EmbeddingSync] Failed to embed entry:', res.statusText);
      return false;
    }

    const data = await res.json();
    if (Array.isArray(data.embedding) && data.embedding.length > 0) {
      await updateEntryEmbedding(userId, entry.id, data.embedding, data.hash || currentHash);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[EmbeddingSync] Background sync error for entry:', entry.id, err);
    return false;
  }
}

/**
 * Background batch synchronization for existing historical entries missing embeddings.
 * Processes entries gently with brief pauses to avoid rate limits.
 */
export async function syncMissingHistoricalEmbeddings(
  userId: string,
  entries: JournalEntry[]
): Promise<number> {
  if (!userId || !Array.isArray(entries) || entries.length === 0) return 0;

  const missing = entries.filter(
    (e) =>
      shouldEmbedEntry(e) &&
      (!Array.isArray(e.embedding) || e.embedding.length === 0)
  );

  if (missing.length === 0) return 0;

  let syncedCount = 0;
  // Process up to 5 missing embeddings per pass in background
  for (const entry of missing.slice(0, 5)) {
    const success = await syncEntryEmbedding(userId, entry);
    if (success) syncedCount++;
    // Small pause between embedding calls
    await new Promise((r) => setTimeout(r, 400));
  }

  return syncedCount;
}
