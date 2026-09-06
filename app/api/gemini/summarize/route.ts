import { NextRequest, NextResponse } from 'next/server';
import {
  generateContentWithFallback,
  generateEmbeddingWithFallback,
  getSemanticRepresentation,
  computeSemanticHash,
} from '@/lib/gemini-client';

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

    const data = body && typeof body === 'object' ? body : {};
    const content = typeof data.content === 'string' ? data.content : '';
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const initialPrompt = typeof data.initialPrompt === 'string' ? data.initialPrompt : '';
    const journalDate = typeof data.journalDate === 'string' ? data.journalDate : '';
    const currentTitle = typeof data.currentTitle === 'string' ? data.currentTitle : '';
    const manualTags: string[] = Array.isArray(data.manualTags) ? data.manualTags : [];

    // Convert HTML content into clean plain text for the LLM if rich text provided
    const cleanContent = content
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    // Check if there is any substantial content to synthesize
    if (!cleanContent && !initialPrompt && messages.length === 0) {
      return NextResponse.json(
        { error: 'Cannot synthesize empty reflection. Write notes or reflect in chat first.' },
        { status: 400 }
      );
    }

    // Consolidate both written journal content AND multi-turn chat messages
    let journalText = '';
    if (cleanContent) {
      journalText += `=== JOURNAL CANVAS WRITTEN CONTENT ===\n${cleanContent}\n\n`;
    }
    if (messages.length > 0) {
      journalText += `=== MULTI-TURN REFLECTION CHAT MESSAGES ===\n`;
      for (const msg of messages) {
        const speaker = msg.role === 'user' ? 'User' : 'Reflection Guide';
        journalText += `${speaker}: ${msg.content}\n\n`;
      }
    }
    if (!cleanContent && messages.length === 0 && initialPrompt) {
      journalText += `Initial Entry: ${initialPrompt}\n\n`;
    }

    const prompt = `You are the centralized synthesis and metadata engine for a private, minimalist journaling application with long-term memory.
Analyze the following personal daily journal text and accompanying multi-turn reflection chat conversation.

Your objective is to extract structured, grounded insights to map the user's personal development over time. This data powers the 5-key synthesis canvas and long-term pattern recognition. Strictly avoid clinical jargon or invented facts.

Return ONLY valid JSON with this exact structure:
{
  "title": "A short, evocative 3-6 word title capturing the core emotional spirit and theme of this day.",
  "summary": "A concise, highly factual 2-3 sentence executive digest of the concrete events, people, and topics discussed (e.g., specific names, projects, or distinct occurrences). This is hidden from the user and used solely for background historical pattern matching.",
  "synthesis": "A rich, warm 2-paragraph narrative tracing the user's internal realizations and shifts in perspective. This must not simply parrot back what happened, but capture how their internal thinking unfolded.",
  "keyInsights": [
    "Observation 1 regarding emotional tone, cognitive perspective, or recurring pattern grounded purely in the text.",
    "Observation 2 regarding tensions, breakthroughs, or questions explored.",
    "Observation 3 regarding growth or forward-looking perspective."
  ],
  "tags": ["3 to 5 lowercase thematic tags (e.g., career, relationship, boundaries, anxiety, family, resilience, growth)."]
}

${journalDate ? `Journal Date: ${journalDate}\n` : ''}
${currentTitle ? `User Assigned Title: ${currentTitle}\n` : ''}
${journalText}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.warn('Failed to parse JSON response from Gemini, falling back to text extraction:', parseErr);
      parsed = {
        title: currentTitle || 'Daily Reflection',
        summary: text.slice(0, 300),
        synthesis: text,
        keyInsights: [],
        tags: ['Daily'],
      };
    }

    // Preserve user manual tags and append newly generated tags without duplicates
    const combinedTags = [...manualTags];
    const generatedTags: string[] = Array.isArray(parsed.tags) ? parsed.tags : ['daily'];
    for (const genTag of generatedTags) {
      const clean = String(genTag).trim().replace(/^#/, '');
      if (clean && !combinedTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
        combinedTags.push(clean);
      }
    }

    const titleResult = parsed.title || currentTitle || 'Daily Reflection';
    const summaryResult = parsed.summary || 'Summary unavailable.';
    const synthesisResult = parsed.synthesis || parsed.summary || '';
    const keyInsightsResult = Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [];
    const tagsResult = combinedTags.length > 0 ? combinedTags : ['daily'];
    const lastSynthesizedAt = new Date().toISOString();

    // Centralized embedding generation in the same pipeline
    const semanticText = getSemanticRepresentation({
      title: titleResult,
      summary: summaryResult,
      tags: tagsResult,
      keyInsights: keyInsightsResult,
    });
    const hash = computeSemanticHash(semanticText);

    let embeddingValues: number[] = [];
    try {
      const embedRes = await generateEmbeddingWithFallback(semanticText);
      embeddingValues = embedRes.values;
    } catch (embedErr) {
      console.warn('Embedding generation in centralized synthesis skipped/deferred:', embedErr);
    }

    return NextResponse.json({
      title: titleResult,
      summary: summaryResult,
      synthesis: synthesisResult,
      keyInsights: keyInsightsResult,
      tags: tagsResult,
      manualTags,
      lastSynthesizedAt,
      embedding: embeddingValues,
      embeddingSourceHash: hash,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Centralized Gemini Synthesis API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to synthesize journal entry metadata.' },
      { status: 500 }
    );
  }
}
