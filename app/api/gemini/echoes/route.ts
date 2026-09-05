import { NextRequest, NextResponse } from 'next/server';
import {
  generateEmbeddingWithFallback,
  generateContentWithFallback,
  cosineSimilarity,
} from '@/lib/gemini-client';
import { EchoReference, EchoDetectionResult } from '@/lib/types';

interface CandidateInput {
  id: string;
  title: string;
  summary?: string;
  initialPrompt?: string;
  tags?: string[];
  keyInsights?: string[];
  createdAt: string;
  embedding?: number[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const data = body && typeof body === 'object' ? body : {};

    const currentPrompt = typeof data.currentPrompt === 'string' ? data.currentPrompt.trim() : '';
    const currentEntryId = typeof data.currentEntryId === 'string' ? data.currentEntryId : '';
    const rawCandidates = Array.isArray(data.candidates) ? data.candidates : [];

    // Short thought guard - avoid triggering on single-word or empty queries
    if (!currentPrompt || currentPrompt.length < 15) {
      return NextResponse.json<EchoDetectionResult>({
        hasEcho: false,
        echoes: [],
      });
    }

    // Filter valid historical candidates with existing vector embeddings, excluding active entry
    const validCandidates: CandidateInput[] = rawCandidates.filter(
      (c: any) =>
        c &&
        typeof c.id === 'string' &&
        c.id !== currentEntryId &&
        Array.isArray(c.embedding) &&
        c.embedding.length > 0
    );

    if (validCandidates.length === 0) {
      return NextResponse.json<EchoDetectionResult>({
        hasEcho: false,
        echoes: [],
      });
    }

    // 1. Generate semantic embedding vector for current prompt
    const { values: queryEmbedding } = await generateEmbeddingWithFallback(currentPrompt);

    // 2. Perform Vector Cosine Similarity search across user's historical memories
    const scoredCandidates = validCandidates
      .map((candidate) => {
        const similarity = cosineSimilarity(queryEmbedding, candidate.embedding || []);
        return { candidate, similarity };
      })
      .filter((item) => item.similarity >= 0.48) // Strict relevance threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3); // Take top 1-3 candidates

    if (scoredCandidates.length === 0) {
      return NextResponse.json<EchoDetectionResult>({
        hasEcho: false,
        echoes: [],
      });
    }

    // 3. Gemini Reasoning Engine: Evaluate whether candidate memories constitute a genuinely meaningful Echo
    const candidatesText = scoredCandidates
      .map((item, index) => {
        const c = item.candidate;
        const dateStr = new Date(c.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        return `[Candidate #${index + 1}]
Entry ID: ${c.id}
Date: ${dateStr}
Title: ${c.title || 'Untitled Reflection'}
Summary: ${c.summary || c.initialPrompt || 'No summary available.'}
Key Takeaways: ${c.keyInsights?.join('; ') || 'None recorded.'}
Themes: ${c.tags?.join(', ') || 'General'}`;
      })
      .join('\n\n');

    const promptForGemini = `You are the empathetic, thoughtful memory reasoning engine for a personal journal sanctuary called "The Open Page".

CURRENT USER THOUGHT:
"${currentPrompt}"

RETRIEVED HISTORICAL MEMORIES (Filtered by vector similarity):
${candidatesText}

YOUR TASK:
Determine whether any of these historical reflections represent a GENUINELY meaningful "Echo" to what the user is currently writing about.

CRITERIA FOR A VALID ECHO:
- An Echo must NOT just be topical keyword matching (e.g. both just mentioning "work" or "coffee").
- An Echo ONLY exists if it provides:
  1. A recurring psychological, behavioural, or emotional pattern the user might not notice.
  2. Important context from a past milestone or realization that speaks to their present dilemma.
  3. Counter-evidence to an assumption or fear they are expressing today based on what happened before.
  4. A past decision that is relevant to a crossroads they are facing now.
  5. A meaningful transformation or contrast over time.

If none of the candidates provide a sufficiently insightful, gentle connection, return "hasEcho": false. Do NOT force an echo.

OUTPUT SCHEMA (JSON ONLY):
{
  "hasEcho": boolean,
  "echoes": [
    {
      "entryId": "exact-entry-id-from-candidate",
      "date": "MMM D, YYYY",
      "connection": "A warm, concise 1-2 sentence realization explaining the specific connection between this past memory and their current thought.",
      "reason": "Why this reflection is uniquely meaningful right now."
    }
  ]
}`;

    const { text: geminiResponse } = await generateContentWithFallback({
      contents: promptForGemini,
      config: {
        responseMimeType: 'application/json',
        systemInstruction:
          'You are a wise, empathetic journaling memory analyst. Output strictly valid JSON matching the requested schema. Never output markdown code fences outside JSON.',
      },
      preferredModel: 'gemini-3.8-flash',
    });

    let parsedResult: { hasEcho: boolean; echoes: any[] };
    try {
      // Clean possible wrapper fences
      const cleaned = geminiResponse
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim();
      parsedResult = JSON.parse(cleaned);
    } catch {
      return NextResponse.json<EchoDetectionResult>({
        hasEcho: false,
        echoes: [],
      });
    }

    if (!parsedResult.hasEcho || !Array.isArray(parsedResult.echoes) || parsedResult.echoes.length === 0) {
      return NextResponse.json<EchoDetectionResult>({
        hasEcho: false,
        echoes: [],
      });
    }

    // Enrich confirmed echoes with historical details for UI preview
    const enrichedEchoes: EchoReference[] = (parsedResult.echoes as any[])
      .map((echo: any): EchoReference | null => {
        const matchingCandidate = scoredCandidates.find(
          (sc) => sc.candidate.id === echo.entryId
        )?.candidate;

        if (!matchingCandidate) return null;

        const dateStr = new Date(matchingCandidate.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        return {
          entryId: matchingCandidate.id,
          date: echo.date || dateStr,
          connection: typeof echo.connection === 'string' ? echo.connection : '',
          reason: typeof echo.reason === 'string' ? echo.reason : '',
          historicalTitle: matchingCandidate.title || 'Past Reflection',
          historicalSummary: matchingCandidate.summary || matchingCandidate.initialPrompt || '',
          historicalTags: matchingCandidate.tags || [],
          historicalInsights: matchingCandidate.keyInsights || [],
        };
      })
      .filter((e): e is EchoReference => e !== null && typeof e.connection === 'string' && e.connection.length > 0);

    return NextResponse.json<EchoDetectionResult>({
      hasEcho: enrichedEchoes.length > 0,
      echoes: enrichedEchoes,
    });
  } catch (error: any) {
    console.error('[API /api/gemini/echoes] Error evaluating Echoes:', error);
    return NextResponse.json<EchoDetectionResult>({
      hasEcho: false,
      echoes: [],
    });
  }
}
