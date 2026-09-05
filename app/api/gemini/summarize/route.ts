import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini-client';

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
        { error: 'Cannot synthesize empty reflection.' },
        { status: 400 }
      );
    }

    // Build the journal text
    let journalText = '';
    if (cleanContent) {
      journalText = cleanContent;
    } else {
      if (initialPrompt) {
        journalText += `Initial Entry: ${initialPrompt}\n\n`;
      }
      for (const msg of messages) {
        const speaker = msg.role === 'user' ? 'User' : 'Reflection Note';
        journalText += `${speaker}: ${msg.content}\n\n`;
      }
    }

    const prompt = `You are a quiet, thoughtful, and perceptive reflective journal companion.
Analyze the following personal daily journal reflection written by the user.

Your goal is to generate a grounded reflective synthesis that helps the user understand what they wrote and how their thinking developed across this reflection.

Guidelines:
1. The synthesis should NOT simply be a generic summary. Help the user trace their internal narrative, realizations, and developing thoughts.
2. Highlight emotional or contextual observations strictly grounded in the user's actual words.
3. Note any subtle shifts, tensions, contradictions, or breakthroughs in their thinking.
4. DO NOT diagnose the user or make unsupported psychological, medical, or clinical claims.
5. DO NOT invent facts, people, or events not present in the journal.
6. Tone must be warm, calm, objective, and respectful.

Return ONLY valid JSON with this exact structure:
{
  "title": "A short, evocative 3-6 word title capturing the core spirit of this reflection",
  "summary": "A concise 2-3 sentence executive summary of what was written and realized",
  "synthesis": "A rich 2-3 paragraph reflective synthesis exploring how the user's perspective unfolded, noting grounded emotional and contextual observations, and identifying subtle shifts or tensions in their thinking",
  "keyInsights": ["3 to 4 concise bullet points highlighting meaningful observations or takeaways grounded in the text"],
  "observations": ["2 to 3 grounded observations on emotional tone, cognitive perspective, or recurring threads"],
  "tags": ["3 to 5 relevant thematic tags, e.g. Clarity, Family, Work, Mindfulness, Transition"]
}

${journalDate ? `Journal Date: ${journalDate}\n` : ''}
Journal Reflection Text:
${journalText}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    try {
      const parsed = JSON.parse(text);
      return NextResponse.json({
        title: parsed.title || 'Daily Reflection',
        summary: parsed.summary || 'Summary unavailable.',
        synthesis: parsed.synthesis || parsed.summary || '',
        keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['Daily'],
        modelUsed,
      });
    } catch (parseErr) {
      console.warn('Failed to parse JSON response from Gemini, falling back to text extraction:', parseErr);
      return NextResponse.json({
        title: 'Daily Reflection',
        summary: text.slice(0, 300),
        synthesis: text,
        keyInsights: [],
        observations: [],
        tags: ['Daily'],
        modelUsed,
      });
    }
  } catch (error: any) {
    console.error('Gemini Summarize API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to synthesize journal entry summary.' },
      { status: 500 }
    );
  }
}
