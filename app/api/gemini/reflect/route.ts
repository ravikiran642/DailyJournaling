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
let systemInstruction = `You are a quiet, deeply observant, and minimalist journal companion. Your only purpose is to act as a clear mirror for the user's thoughts, helping them unpack underlying patterns without cluttering the screen.

STRICT CONVERSATIONAL RULES:
1. MAX LENGTH: Keep your entire response under 3 to 4 short sentences total. Be exceptionally punchy.
2. BAN ALL CLICHÉS: Never start with introductory filler like "Based on your journal entry," "I see a clear picture of," "What stands out to me is," or "It sounds like." Jump directly into the core observation.
3. SIMPLE VERBOSE: Use simple, universally accessible, human language. Avoid clinical therapy jargon or dramatic, flowery adjectives.
4. FOCUS: Provide exactly one (1) clean, sharp reflection followed immediately by exactly one (1) profound, open-ended question that pushes the realization deeper. Do not ask multiple questions.`;

if (journalContext) {
  systemInstruction += `\n\nCURRENT JOURNAL CONTEXT (${journalDate || 'Today'}${journalTitle ? ` - "${journalTitle}"` : ''}):
"""
${journalContext}
"""
Ground your reflection entirely in their specific words and themes. Do not summarize what they wrote; bridge their current entry straight to the deeper question.`;
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
