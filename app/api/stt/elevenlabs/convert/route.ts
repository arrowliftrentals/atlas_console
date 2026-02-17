import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const model = (formData.get('model_id') as string) || 'scribe_v2';

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append('file', file, 'audio.webm');
    upstream.append('model_id', model);

    const resp = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: upstream,
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text || 'Transcribe failed' }, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to transcribe' }, { status: 500 });
  }
}