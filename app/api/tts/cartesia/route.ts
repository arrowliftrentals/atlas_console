import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.CARTESIA_API_KEY) {
      return NextResponse.json(
        { error: "Cartesia API key not configured. Add CARTESIA_API_KEY to console/.env.local" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { text, voice = "1463a4e1-56a1-4b41-b257-728d56e93605", speed = 1.0 } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Validate speed
    if (speed < 0.5 || speed > 2.0) {
      return NextResponse.json(
        { error: "Speed must be between 0.5 and 2.0" },
        { status: 400 }
      );
    }

    // Call Cartesia Sonic 3 API
    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": process.env.CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: "sonic-3",
        transcript: text,
        voice: {
          mode: "id",
          id: voice,
        },
        output_format: {
          container: "raw",
          encoding: "pcm_f32le",
          sample_rate: 44100,
        },
        language: "en",
        speed: speed,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Cartesia TTS] Error:", error);
      return NextResponse.json(
        { error: `Cartesia TTS failed: ${response.status} - ${error}` },
        { status: 500 }
      );
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer();

    // Return as raw PCM audio
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/pcm",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error("[Cartesia TTS] Error:", error);
    return NextResponse.json(
      { error: error.message || "TTS synthesis failed" },
      { status: 500 }
    );
  }
}
