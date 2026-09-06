export type ReflectionMode = 'reflection' | 'brainstorm' | 'gratitude' | 'decision' | 'summary' | 'daily';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface EchoReference {
  entryId: string;
  date: string;
  connection: string;
  reason: string;
  historicalTitle?: string;
  historicalSummary?: string;
  historicalTags?: string[];
  historicalInsights?: string[];
}

export interface EchoDetectionResult {
  hasEcho: boolean;
  echoes: EchoReference[];
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  reflectionType: ReflectionMode;
  initialPrompt?: string;
  content?: string; // Rich-text HTML content of the journal reflection
  journalDate?: string; // Local calendar date in YYYY-MM-DD
  isDailyPrimary?: boolean; // True if this is the primary reflection for the calendar day
  summary?: string;
  synthesis?: string; // AI-generated reflective synthesis exploring developments, tensions, and realizations
  keyInsights?: string[];
  tags: string[];
  manualTags?: string[]; // Tags manually created/flagged by the user that must not be overwritten during AI synthesis
  messages?: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  embedding?: number[];
  embeddingSourceHash?: string;
  confirmedEchoContext?: EchoReference[];
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface SilentGuideSuggestion {
  category: 'historical_pivot' | 'mood_curveball' | 'zero_pressure_dump' | 'physical_grounding' | 'sensory_anchor' | 'perspective_shift' | string;
  label: string;
  badge: string;
  prompt: string;
  rationale?: string;
}

export interface SilentGuideResponse {
  detectedTone?: string;
  cognitiveState?: string;
  suggestions: SilentGuideSuggestion[];
}
