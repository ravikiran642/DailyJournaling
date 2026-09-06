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
    const rawCandidates: any[] = Array.isArray(data.candidates)
      ? data.candidates
      : Array.isArray(data.historicalEntries)
      ? data.historicalEntries
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

    const promptForGemini = `ANALYZE THE USER'S CURRENT JOURNAL SESSION AND STALL POINT:

Current Journal Date: ${journalDate || 'Today'}

Active Draft So Far:
"""
${truncatedCurrentText}
"""

Last Sentence / Words Typed Before Inactivity Stall:
"""
${lastSentence}
"""

${
  hasSemanticMatch
    ? `SEMANTICALLY MATCHED HISTORICAL JOURNAL MEMORIES (Vector Cosine Similarity Pipeline):
${formattedSemanticHistory}

CRITICAL REQUIREMENT:
Because strong semantic echoes exist in their historical journals, you MUST include a "historical_pivot" as the PRIMARY (first) recommendation in the suggestions array. Connect the active stall point to this specific past memory.`
    : `No close semantic matches found in past entries.`
}

TASK FOR THE SILENT GUIDE:
1. Read the user's active draft and identify their immediate friction state:
   - Are they spiraling in rumination or self-criticism?
   - Did they pause mid-thought trying to choose the "perfect" words?
   - Are they exhausted or numb?
   - Did they stumble upon an uncomfortable or complex emotional realization?
2. Select EXACTLY TWO (2) of the BEST assistance categories that precisely address this friction:
   - "historical_pivot": ${
     hasSemanticMatch
       ? 'MANDATORY PRIMARY CHOICE. Grounded in specific insights, people, or reflections from the retrieved semantic memories.'
       : 'Grounded in past wins or past dilemmas from their reflections.'
   }
   - "zero_pressure_dump": A raw, uncensored stream-of-consciousness continuation prompt tethered directly to the last words/sentence they stalled on.
   - "mood_curveball": A delightful, counter-intuitive, or playful question designed to shatter cognitive loops and lower stakes.
   - "physical_grounding": An invitation to notice somatic tension (shoulders, breathing, jaw) and drop back into the body.
   - "sensory_anchor": An invitation to anchor into immediate sensory surroundings (ambient sounds, light, temperature).
   - "perspective_shift": Inviting an outside or future viewpoint (e.g., what their 80-year-old self would whisper).

STRICT OUTPUT CONSTRAINTS:
- Maximum of TWO (2) suggestions in the "suggestions" array.
- High-contrast, friendly, non-judgmental tone.
- Output strictly valid JSON matching this schema:
{
  "detectedTone": "short string describing the emotional tone (e.g. 'reflective curiosity', 'workplace exhaustion', 'anxious loop')",
  "cognitiveState": "short explanation of the friction barrier",
  "suggestions": [
    {
      "category": "category_key",
      "label": "Dynamic Category Name (e.g. 'Historical Pivot', 'Zero-Pressure Dump')",
      "badge": "2-3 word dynamic pill label (e.g. 'Past Echo', 'Raw Stream')",
      "prompt": "The conversational prompt copy written in the Friendly Companion Voice",
      "rationale": "Why this suggestion matches their immediate friction"
    }
  ]
}`;

    const systemInstruction = `You are "The Silent Guide", an ultra-minimalist, intuitive AI writing companion.
Your goal is to gently dissolve writer's block by dynamically selecting the 2 most resonant momentum sparks based on real-time text analysis and semantic memory.
Maintain a warm, reassuring, pressure-free companion tone. Never give unsolicited advice or lecture.
Output valid JSON only. Output at most 2 suggestions.`;

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
