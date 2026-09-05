import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini-client';
import { SilentGuideResponse, SilentGuideSuggestion } from '@/lib/types';

interface HistoricalEntryExcerpt {
  id?: string;
  title?: string;
  journalDate?: string;
  date?: string;
  summary?: string;
  tags?: string[];
  keyInsights?: string[];
  initialPrompt?: string;
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
    const rawHistoricalEntries = Array.isArray(data.historicalEntries) ? data.historicalEntries : [];

    // Guard against empty input: if user hasn't typed anything, return default onboarding guidance
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

    // Format historical entries for context injection (up to 6 recent entries)
    const formattedHistory = rawHistoricalEntries
      .slice(0, 6)
      .map((entry: HistoricalEntryExcerpt) => {
        const title = entry.title || 'Untitled Entry';
        const date = entry.journalDate || entry.date || 'Past date';
        const summary = entry.summary || entry.initialPrompt || '';
        const tags = Array.isArray(entry.tags) && entry.tags.length > 0 ? entry.tags.join(', ') : '';
        const insights = Array.isArray(entry.keyInsights) && entry.keyInsights.length > 0
          ? entry.keyInsights.join('; ')
          : '';

        let snippet = `- [${date}] "${title}"`;
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

Recent Historical Journal Context (User's Past Reflections):
${formattedHistory || 'No prior entries available.'}

TASK FOR THE SILENT GUIDE:
1. Read the user's active draft and identify their immediate friction state:
   - Are they spiraling in rumination or self-criticism?
   - Did they pause mid-thought trying to choose the "perfect" words?
   - Are they exhausted or numb?
   - Did they stumble upon an uncomfortable or complex emotional realization?
2. Select the 2 or 3 BEST assistance categories that precisely address this friction:
   - "historical_pivot": Grounded in specific names, people (e.g. Jelia, colleagues, family), past wins, or past dilemmas from their historical entries. (e.g. "You felt this exact tension with Jelia last Tuesday. What did you wish you had said then?").
   - "mood_curveball": A delightful, counter-intuitive, or playful question designed to shatter cognitive loops and lower stakes.
   - "zero_pressure_dump": A raw, uncensored stream-of-consciousness continuation prompt tethered directly to the last words/sentence they stalled on.
   - "physical_grounding": An invitation to notice somatic tension (shoulders, breathing, jaw) and drop back into the body.
   - "sensory_anchor": An invitation to anchor into immediate sensory surroundings (ambient sounds, light, temperature).
   - "perspective_shift": Inviting an outside or future viewpoint (e.g., what their 80-year-old self would whisper).

OUTPUT FORMAT:
Output strictly valid JSON matching this schema:
{
  "detectedTone": "short string describing the emotional tone (e.g. 'anxious overthinking', 'reflective curiosity', 'workplace exhaustion', 'self-critical lock')",
  "cognitiveState": "short explanation of the friction barrier",
  "suggestions": [
    {
      "category": "category_key",
      "label": "Dynamic Category Name (e.g. 'Historical Pivot', 'Mood-Shifting Curveball', 'Zero-Pressure Dump')",
      "badge": "2-3 word dynamic pill label (e.g. 'Past Connection', 'Break Loop', 'Raw Stream')",
      "prompt": "The conversational prompt copy written in the Friendly Companion Voice",
      "rationale": "Why this suggestion matches their immediate friction"
    }
  ]
}`;

    const systemInstruction = `You are "The Silent Guide", an ultra-minimalist, intuitive AI writing companion.
Your goal is to gently dissolve writer's block by dynamically selecting the 2 or 3 most resonant momentum sparks based on real-time text analysis and historical context.
Maintain a warm, reassuring, pressure-free companion tone. Never give unsolicited advice or lecture.
Output valid JSON only.`;

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
      parsedResult = buildFallbackSuggestions(lastSentence, rawHistoricalEntries);
    }

    if (!parsedResult || !Array.isArray(parsedResult.suggestions) || parsedResult.suggestions.length === 0) {
      parsedResult = buildFallbackSuggestions(lastSentence, rawHistoricalEntries);
    }

    return NextResponse.json<SilentGuideResponse>(parsedResult);
  } catch (error: any) {
    console.error('Error generating dynamic Silent Guide suggestions:', error);
    // Provide resilient fallback even on unexpected backend errors
    const fallback = buildFallbackSuggestions('', []);
    return NextResponse.json<SilentGuideResponse>(fallback, { status: 200 });
  }
}

/**
 * Robust fallback generator guaranteeing valid contextual suggestions
 * if the AI service experiences network or formatting hiccups.
 */
function buildFallbackSuggestions(
  lastSentence: string,
  historicalEntries: HistoricalEntryExcerpt[]
): SilentGuideResponse {
  const suggestions: SilentGuideSuggestion[] = [];

  // 1. Historical Pivot (incorporating real past entity if available)
  const recentHistory = historicalEntries.find((h) => h.title || h.summary);
  if (recentHistory) {
    const historicalTitle = recentHistory.title || 'recent reflection';
    suggestions.push({
      category: 'historical_pivot',
      label: 'Historically-Linked Pivot',
      badge: 'Past Echo',
      prompt: `Let's pivot and write about what happened yesterday with Jelia, or revisit "${historicalTitle}" to look at this from another angle.`,
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

  // 2. Mood-Shifting Curveball
  suggestions.push({
    category: 'mood_curveball',
    label: 'Mood-Shifting Curveball',
    badge: 'Disrupt Loop',
    prompt: "Curveball: Close your eyes for 3 seconds. What's the weirdest sound you hear right now, or what is one thing you really want to eat tonight?",
    rationale: 'Playfully shatters cognitive lock with unexpected sensory redirection.',
  });

  // 3. Zero-Pressure Dump
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
    suggestions,
  };
}
