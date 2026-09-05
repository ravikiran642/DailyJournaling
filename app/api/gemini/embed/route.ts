import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddingWithFallback, computeSemanticHash } from '@/lib/gemini-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const data = body && typeof body === 'object' ? body : {};
    const text = typeof data.text === 'string' ? data.text.trim() : '';

    if (!text) {
      return NextResponse.json(
        { error: 'Invalid input. Text to embed must not be empty.' },
        { status: 400 }
      );
    }

    const hash = computeSemanticHash(text);
    const { values, modelUsed } = await generateEmbeddingWithFallback(text);

    return NextResponse.json({
      embedding: values,
      hash,
      modelUsed,
    });
  } catch (error: any) {
    console.error('[API /api/gemini/embed] Error generating embedding:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to generate embedding vector.',
      },
      { status: 500 }
    );
  }
}
