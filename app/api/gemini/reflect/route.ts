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

    // Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = body && typeof body === 'object' ? body : {};
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const mode = typeof data.mode === 'string' ? data.mode : 'reflection';
    const userPrompt = typeof data.prompt === 'string' ? data.prompt.trim() : '';
    const confirmedEchoes = Array.isArray(data.confirmedEchoContext) ? data.confirmedEchoContext : [];
    const journalContext = typeof data.journalContext === 'string' ? data.journalContext.trim() : '';
    const journalDate = typeof data.journalDate === 'string' ? data.journalDate.trim() : '';
    const journalTitle = typeof data.journalTitle === 'string' ? data.journalTitle.trim() : '';

    if (!userPrompt && messages.length === 0) {
      return NextResponse.json(
        { error: 'Prompt or conversation history is required.' },
        { status: 400 }
      );
    }

    // Construct system instructions based on reflection mode
    let systemInstruction = `You are a thoughtful, empathetic, and intellectually curious reflection partner and journal companion.
Your purpose is to help the user unpack their thoughts, gain clarity, explore underlying feelings or motivations, identify blind spots, and discover constructive ways forward.

Guidelines:
- Maintain an encouraging, warm, non-judgmental, and insightful tone.
- Validate the user's emotional experience when appropriate.
- Ask 1-2 open-ended, thought-provoking questions that inspire deeper self-awareness.
- Structure responses clearly with brief paragraphs or concise bullet points where helpful.
- Avoid generic cliches or unsolicited advice unless explicitly requested.`;

    if (journalContext) {
      systemInstruction += `\n\nCURRENT JOURNAL ENTRY CONTEXT (${journalDate || 'Current Day'}${journalTitle ? ` - "${journalTitle}"` : ''}):
"""
${journalContext}
"""
The user is conversing with you directly anchored in this journal writing. Reference and reflect on their specific themes, thoughts, and words when insightful and helpful.`;
    }

    if (mode === 'brainstorm') {
      systemInstruction = `You are a creative brainstorming partner.
Help the user expand upon their ideas, generate novel angles, challenge assumptions, and structure creative possibilities while preserving their original vision. Provide distinct perspectives and actionable suggestions.`;
    } else if (mode === 'gratitude') {
      systemInstruction = `You are a mindfulness and gratitude companion.
Help the user savor positive moments, appreciate lessons learned, deepen gratitude for the present, and notice subtle joys in their everyday life.`;
    } else if (mode === 'decision') {
      systemInstruction = `You are an objective decision-making and problem-solving mentor.
Help the user clarify their decision criteria, weigh trade-offs (pros/cons, 2nd order consequences), examine underlying values, and pinpoint the best next micro-step.`;
    } else if (mode === 'summary') {
      systemInstruction = `You are an analytical journal synthesis assistant.
Help the user synthesize their reflections into core themes, actionable insights, and personal growth markers.`;
    }

    // If the user has confirmed historical Echo connections, append this active memory context
    if (confirmedEchoes.length > 0) {
      const echoContextText = confirmedEchoes
        .map((echo: any) => {
          return `[Past Reflection: "${echo.historicalTitle || 'Historical Entry'}" (${echo.date})]
Connection: ${echo.connection}
Past Summary: ${echo.historicalSummary || 'N/A'}`;
        })
        .join('\n\n');

      systemInstruction += `\n\nCONFIRMED HISTORICAL JOURNAL CONTEXT:
The user has confirmed that the following historical reflection(s) are relevant to their current reflection:
${echoContextText}

Instructions for using historical context:
- Seamlessly weave this context into your companion insights if relevant.
- Acknowledge how their present situation connects to or builds upon what they learned before.
- Keep the main focus on their present experience and forward momentum.`;
    }

    // Format conversation history for Gemini
    const contents: any[] = [];

    // Add prior messages if available
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') continue;
      const role = msg.role === 'model' ? 'model' : 'user';
      const content = typeof msg.content === 'string' ? msg.content : '';
      if (content.trim()) {
        contents.push({
          role,
          parts: [{ text: content }],
        });
      }
    }

    // If new prompt provided and not already last message, add it
    if (userPrompt) {
      const lastMsg = contents[contents.length - 1];
      if (!lastMsg || lastMsg.role !== 'user' || lastMsg.parts[0]?.text !== userPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: userPrompt }],
        });
      }
    }

    if (contents.length === 0) {
      return NextResponse.json(
        { error: 'No valid content to generate reflection.' },
        { status: 400 }
      );
    }

    const { text, modelUsed } = await generateContentWithFallback({
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    return NextResponse.json({
      text,
      modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Gemini Reflection API error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to generate reflection with Gemini AI.',
      },
      { status: 500 }
    );
  }
}
