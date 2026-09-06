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

const prompt = `You are the backend metadata engine for a highly private, minimalist journaling application with a long-term historical tracking memory.
Analyze the following personal daily journal text and accompanying reflection chat. 

Your objective is to extract structured, grounded insights to map the user's personal development over time. This data will be used to power a historical "Echo" feature that alerts users when current situations mirror past events. Strictly avoid any clinical diagnosis or invented facts.

Return ONLY valid JSON with this exact structure:
{
  "title": "A short, evocative 3-6 word title capturing the core emotional spirit of this day.",
  
  "summary": "A concise, highly factual 2-3 sentence overview of the concrete events, people, and topics discussed (e.g., specific names, projects, or distinct occurrences). This is hidden from the user and used solely for background historical pattern matching.",
  
  "synthesis": "A rich, warm 2-paragraph narrative tracing the user's internal realizations and shifts in perspective. This must not simply parrot back what happened, but capture how their internal thinking unfolded.",
  
  "keyInsights": ["3 specific, distinct observations regarding the user's emotional tone, cognitive perspective, or recurring behavioral patterns grounded purely in the text."],
  
  "tags": ["3 to 5 lowercase thematic tags (e.g., career, relationship, boundaries, anxiety, growth) for database charting."]
}

${journalDate ? `Journal Date: ${journalDate}\n` : ''}
Journal Entry & Reflection Chat Text:
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
