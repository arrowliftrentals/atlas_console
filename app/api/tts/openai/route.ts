import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Add OPENAI_API_KEY to console/.env.local or use the Bettany (local) TTS provider instead." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = await request.json();
    const { text, voice = "onyx", speed = 1.0 } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Validate voice
    const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    if (!validVoices.includes(voice)) {
      return NextResponse.json(
        { error: `Invalid voice. Must be one of: ${validVoices.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate speed
    if (speed < 0.25 || speed > 4.0) {
      return NextResponse.json(
        { error: "Speed must be between 0.25 and 4.0" },
        { status: 400 }
      );
    }

    // Call OpenAI TTS API
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: text,
      speed: speed,
    });

    // Get the audio data as a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Return as MP3 audio
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("[OpenAI TTS] Error:", error);
    return NextResponse.json(
      { error: error.message || "TTS synthesis failed" },
      { status: 500 }
    );
  }
}
