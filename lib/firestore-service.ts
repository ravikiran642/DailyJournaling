import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { JournalEntry, ChatMessage } from './types';

/**
 * Strict Undefined-Stripping Utility to ensure zero-crash payload hygiene for Firestore.
 */
export function sanitizePayload<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (value === undefined) {
        return null;
      }
      return value;
    })
  );
}

/**
 * Get user journal entries collection reference
 */
function getEntriesRef(userId: string) {
  if (!userId) {
    throw new Error('User ID is required for Firestore operations.');
  }
  return collection(db, 'users', userId, 'journalEntries');
}

/**
 * Save a new journal entry
 */
export async function saveJournalEntry(
  userId: string,
  entry: Omit<JournalEntry, 'id'> & { id?: string }
): Promise<JournalEntry> {
  if (!userId) {
    throw new Error('Unauthorized: User ID missing.');
  }

  const entriesRef = getEntriesRef(userId);
  const docRef = entry.id ? doc(entriesRef, entry.id) : doc(entriesRef);
  const entryId = docRef.id;

  const now = new Date().toISOString();
  const fullEntry: JournalEntry = {
    ...entry,
    id: entryId,
    userId,
    createdAt: entry.createdAt || now,
    updatedAt: now,
    tags: entry.tags || [],
    messages: entry.messages || [],
    keyInsights: entry.keyInsights || [],
    observations: entry.observations || [],
    content: entry.content || '',
    isDailyPrimary: entry.isDailyPrimary ?? false,
    journalDate: entry.journalDate,
  };

  const cleanData = sanitizePayload(fullEntry);
  await setDoc(docRef, cleanData);
  return fullEntry;
}

/**
 * Fetch the primary daily reflection for a specific local calendar date (YYYY-MM-DD)
 */
export async function fetchDailyJournalForDate(
  userId: string,
  dateStr: string
): Promise<JournalEntry | null> {
  if (!userId || !dateStr) return null;
  const entriesRef = getEntriesRef(userId);
  const q = query(
    entriesRef,
    where('journalDate', '==', dateStr),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as JournalEntry;
}

/**
 * Save or update the single primary daily journal reflection for a calendar day.
 * Ensures one primary reflection per day, updates updatedAt, and strips undefined values.
 */
export async function saveOrUpdateDailyJournal(
  userId: string,
  dateStr: string,
  data: {
    id?: string;
    title: string;
    content: string;
    summary?: string;
    synthesis?: string;
    keyInsights?: string[];
    observations?: string[];
    tags?: string[];
    manualTags?: string[];
  }
): Promise<JournalEntry> {
  if (!userId) {
    throw new Error('Unauthorized: User ID missing.');
  }

  let targetId = data.id;

  // If no entry ID was provided, search if a daily journal exists for this calendar date
  if (!targetId) {
    const existing = await fetchDailyJournalForDate(userId, dateStr);
    if (existing) {
      targetId = existing.id;
    }
  }

  const entriesRef = getEntriesRef(userId);
  const now = new Date().toISOString();

  if (targetId) {
    const docRef = doc(entriesRef, targetId);
    const updates: Partial<JournalEntry> = {
      title: data.title,
      content: data.content,
      journalDate: dateStr,
      isDailyPrimary: true,
      updatedAt: now,
      ...(data.summary !== undefined ? { summary: data.summary } : {}),
      ...(data.synthesis !== undefined ? { synthesis: data.synthesis } : {}),
      ...(data.keyInsights !== undefined ? { keyInsights: data.keyInsights } : {}),
      ...(data.observations !== undefined ? { observations: data.observations } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.manualTags !== undefined ? { manualTags: data.manualTags } : {}),
    };

    await updateDoc(docRef, sanitizePayload(updates));
    const snap = await getDoc(docRef);
    return snap.data() as JournalEntry;
  } else {
    const newDocRef = doc(entriesRef);
    const newEntry: JournalEntry = {
      id: newDocRef.id,
      userId,
      title: data.title || 'Daily Reflection',
      reflectionType: 'daily',
      content: data.content,
      journalDate: dateStr,
      isDailyPrimary: true,
      summary: data.summary,
      synthesis: data.synthesis,
      keyInsights: data.keyInsights || [],
      observations: data.observations || [],
      tags: data.tags && data.tags.length > 0 ? data.tags : ['Daily'],
      manualTags: data.manualTags || [],
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(newDocRef, sanitizePayload(newEntry));
    return newEntry;
  }
}

/**
 * Update an existing journal entry
 */
export async function updateJournalEntry(
  userId: string,
  entryId: string,
  updates: Partial<JournalEntry>
): Promise<void> {
  if (!userId || !entryId) {
    throw new Error('Invalid parameters: userId and entryId required.');
  }

  const docRef = doc(db, 'users', userId, 'journalEntries', entryId);
  const cleanUpdates = sanitizePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  await updateDoc(docRef, cleanUpdates);
}

/**
 * Append a chat message to an existing entry
 */
export async function appendMessageToEntry(
  userId: string,
  entryId: string,
  message: ChatMessage
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'journalEntries', entryId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Journal entry not found');
  }

  const existingData = snap.data() as JournalEntry;
  const updatedMessages = [...(existingData.messages || []), message];

  await updateDoc(
    docRef,
    sanitizePayload({
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    })
  );
}

/**
 * Fetch all entries for a specific user
 */
export async function fetchUserJournalEntries(userId: string): Promise<JournalEntry[]> {
  if (!userId) return [];
  const entriesRef = getEntriesRef(userId);
  const q = query(entriesRef, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => docSnap.data() as JournalEntry);
}

/**
 * Subscribe to realtime updates for a user's journal entries
 */
export function subscribeToUserJournalEntries(
  userId: string,
  callback: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const entriesRef = getEntriesRef(userId);
  const q = query(entriesRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs.map((docSnap) => docSnap.data() as JournalEntry);
      callback(entries);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Update an entry's embedding vector and semantic hash
 */
export async function updateEntryEmbedding(
  userId: string,
  entryId: string,
  embedding: number[],
  hash: string
): Promise<void> {
  if (!userId || !entryId || !embedding || embedding.length === 0) return;
  const docRef = doc(db, 'users', userId, 'journalEntries', entryId);
  await updateDoc(
    docRef,
    sanitizePayload({
      embedding,
      embeddingSourceHash: hash,
    })
  );
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) {
    throw new Error('Invalid arguments for entry deletion.');
  }
  const docRef = doc(db, 'users', userId, 'journalEntries', entryId);
  await deleteDoc(docRef);
}
