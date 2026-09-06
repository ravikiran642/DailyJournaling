import { NextRequest, NextResponse } from 'next/server';
import {
  generateContentWithFallback,
  generateEmbeddingWithFallback,
  cosineSimilarity,
} from '@/lib/gemini-client';
import { SilentGuideResponse, SilentGuideSuggestion } from '@/lib/types';

interface CandidateEntry {
  id?: string;
  title?: string;
  journalDate?: string;
  date?: string;
  summary?: string;
  tags?: string[];
  keyInsights?: string[];
  initialPrompt?: string;
  embedding?: number[];
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body' },
        { status: 400 }
      );
    }

    // Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = body && typeof body === 'object' ? body : {};
    const rawCurrentText = typeof data.currentText === 'string' ? data.currentText.trim() : '';
    const rawLastSentence = typeof data.lastSentence === 'string' ? data.lastSentence.trim() : '';
    const journalDate = typeof data.journalDate === 'string' ? data.journalDate : '';
    const rawCandidates: any[] = Array.isArray(data.allEntries)
      ? data.allEntries
      : [];

    // Guard against empty input: if user hasn't typed anything, return default onboarding guidance (strictly 2 items)
    if (!rawCurrentText && !rawLastSentence) {
      return NextResponse.json<SilentGuideResponse>({
        detectedTone: 'empty_canvas',
        cognitiveState: 'blank canvas opening',
        suggestions: [
          {
            category: 'zero_pressure_dump',
            label: 'Zero-Pressure Dump',
            badge: 'Start Anywhere',
            prompt: 'Write one unfiltered sentence about the very first thing that comes to your mind right now.',
            rationale: 'Dissolves blank page paralysis with zero structural expectation.',
          },
          {
            category: 'sensory_anchor',
            label: 'Sensory Recall',
            badge: 'Grounding Anchor',
            prompt: 'Describe three physical things in the room around you right now.',
            rationale: 'Provides effortless concrete details to build writing momentum.',
          },
        ],
      });
    }

    // Limit text length to prevent excessive token payload
    const truncatedCurrentText = rawCurrentText.slice(-3000);
    const lastSentence = rawLastSentence.slice(-300) || truncatedCurrentText.slice(-150);

    // Filter valid historical candidates that possess vector embeddings
    const validCandidates: CandidateEntry[] = rawCandidates.filter(
      (c: any) =>
        c &&
        typeof c === 'object' &&
        Array.isArray(c.embedding) &&
        c.embedding.length > 0 &&
        (c.journalDate !== journalDate)
    );

    // Vector pipeline: Generate semantic vector embedding for the active writing context
    let topMatchedCandidates: Array<{ candidate: CandidateEntry; similarity: number }> = [];

    if (truncatedCurrentText.length >= 15 && validCandidates.length > 0) {
      try {
        const { values: queryEmbedding } = await generateEmbeddingWithFallback(truncatedCurrentText);

        topMatchedCandidates = validCandidates
          .map((candidate) => ({
            candidate,
            similarity: cosineSimilarity(queryEmbedding, candidate.embedding || []),
          }))
          .filter((item) => item.similarity >= 0.40)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 3);
      } catch (embeddingErr) {
        console.warn('[Silent Guide] Embedding generation failed, continuing without vector context:', embeddingErr);
      }
    }

    const hasSemanticMatch = topMatchedCandidates.length > 0;

    // Format top semantic matches for context injection
    const formattedSemanticHistory = topMatchedCandidates
      .map(({ candidate: entry, similarity }) => {
        const title = entry.title || 'Untitled Past Entry';
        const date = entry.journalDate || entry.date || 'Past date';
        const summary = entry.summary || entry.initialPrompt || '';
        const tags = Array.isArray(entry.tags) && entry.tags.length > 0 ? entry.tags.join(', ') : '';
        const insights =
          Array.isArray(entry.keyInsights) && entry.keyInsights.length > 0
            ? entry.keyInsights.join('; ')
            : '';

        let snippet = `- [${date}] "${title}" (Semantic Similarity: ${(similarity * 100).toFixed(0)}%)`;
        if (summary) snippet += `\n  Summary: ${summary}`;
        if (tags) snippet += `\n  Tags: ${tags}`;
        if (insights) snippet += `\n  Insights: ${insights}`;
        return snippet;
      })
      .join('\n\n');

    const promptForGemini = `You are analyzing a user's active journal session to resolve a writing block.

[Session Data]
Journal Date: ${journalDate || 'Today'}
Active Draft: "${truncatedCurrentText}"
Stalled Words: "${lastSentence}"

${formattedSemanticHistory ? `[Relevant Historical Memories]\n${formattedSemanticHistory}` : ''}

[Instructions]
1. Diagnose the user's immediate writing friction (e.g., rumination, exhaustion, perfectionism).
2. Generate an array of EXACTLY TWO (2) highly tailored companion prompts to dissolve the block.
3. If Historical Memories are provided above, the FIRST prompt object must be a "historical_pivot" that actively weaves specific details from those past records to bridge the connection.
4. The second prompt should be selected dynamically from these categories: "zero_pressure_dump", "mood_curveball", "physical_grounding", "sensory_anchor", or "perspective_shift".

Return ONLY valid JSON matching this exact structure:
{
  "detectedTone": "Short emotional tone description",
  "cognitiveState": "Brief explanation of the friction barrier",
  "suggestions": [
    {
      "category": "category_key",
      "label": "Dynamic Category Name",
      "badge": "2-3 word dynamic pill label",
      "prompt": "The conversational prompt copy written in your friendly companion voice",
      "rationale": "Why this suggestion matches their immediate friction"
    }
  ]
}`;

    const systemInstruction = `You are "The Silent Guide", an ultra-minimalist, intuitive AI writing companion.
Analyze real-time text friction and historical semantic context to output exactly two (2) highly resonant momentum sparks.
Maintain a warm, reassuring, pressure-free companion tone. Never lecture or give unsolicited advice.
Output valid JSON only matching the requested schema.`;

    const { text: rawGeminiResponse } = await generateContentWithFallback({
      contents: promptForGemini,
      config: {
        responseMimeType: 'application/json',
        systemInstruction,
      },
      preferredModel: 'gemini-3.6-flash',
    });

    let parsedResult: SilentGuideResponse;
    try {
      const cleaned = rawGeminiResponse
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim();
      parsedResult = JSON.parse(cleaned);
    } catch {
      // Fallback parser if JSON wrap was malformed
      parsedResult = buildFallbackSuggestions(
        lastSentence,
        topMatchedCandidates.map((m) => m.candidate)
      );
    }

    if (
      !parsedResult ||
      !Array.isArray(parsedResult.suggestions) ||
      parsedResult.suggestions.length === 0
    ) {
      parsedResult = buildFallbackSuggestions(
        lastSentence,
        topMatchedCandidates.map((m) => m.candidate)
      );
    }

    // Strictly enforce maximum of 2 suggestions to preserve minimalist constraints
    if (parsedResult.suggestions.length > 2) {
      parsedResult.suggestions = parsedResult.suggestions.slice(0, 2);
    }

    return NextResponse.json<SilentGuideResponse>(parsedResult);
  } catch (error: any) {
    console.error('Error generating dynamic Silent Guide suggestions:', error);
    // Provide resilient fallback even on unexpected backend errors (strictly 2 items)
    const fallback = buildFallbackSuggestions('', []);
    return NextResponse.json<SilentGuideResponse>(fallback, { status: 200 });
  }
}

/**
 * Robust fallback generator guaranteeing valid contextual suggestions
 * if the AI service experiences network or formatting hiccups.
 * Strictly limited to 2 suggestion objects.
 */
function buildFallbackSuggestions(
  lastSentence: string,
  matchedEntries: CandidateEntry[]
): SilentGuideResponse {
  const suggestions: SilentGuideSuggestion[] = [];

  // 1. Historical Pivot (incorporating real past entity or semantic match if available)
  const topCandidate = matchedEntries[0];
  if (topCandidate) {
    const historicalTitle = topCandidate.title || 'recent reflection';
    suggestions.push({
      category: 'historical_pivot',
      label: 'Historically-Linked Pivot',
      badge: 'Past Echo',
      prompt: `Let's pivot and revisit "${historicalTitle}" to look at this from another angle, or reflect on what you learned then.`,
      rationale: 'Draws a reassuring bridge between past clarity and current pause.',
    });
  } else {
    suggestions.push({
      category: 'historical_pivot',
      label: 'Historically-Linked Pivot',
      badge: 'Past Echo',
      prompt: "Let's pivot and write about that funny thing Jelia did yesterday to break the tension.",
      rationale: 'Introduces a lighthearted personal memory to release pressure.',
    });
  }

  // 2. Zero-Pressure Dump
  const trailingSnippet = lastSentence.trim() ? ` "${lastSentence.slice(0, 60)}..."` : '';
  suggestions.push({
    category: 'zero_pressure_dump',
    label: 'Zero-Pressure Dump',
    badge: 'Raw Stream',
    prompt: trailingSnippet
      ? `Finish this without editing yourself: 'What I really wanted to say after${trailingSnippet} is...'`
      : 'Write one raw, unedited sentence about what is actually stalling your train of thought right now.',
    rationale: 'Gives explicit permission to write messy, unedited thoughts.',
  });

  return {
    detectedTone: 'reflective',
    cognitiveState: 'paused mid-thought',
    suggestions: suggestions.slice(0, 2),
  };
}
