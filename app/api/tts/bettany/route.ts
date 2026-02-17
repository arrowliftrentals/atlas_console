import { NextRequest, NextResponse } from "next/server";

const TTS_SERVER_URL = process.env.BETTANY_TTS_URL || "http://127.0.0.1:5050";
const TTS_SERVER_TIMEOUT = 60000; // 60 seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, speed = 1.1, temperature = 0.6, top_p = 0.8 } = body;

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

    // Validate temperature
    if (temperature < 0.1 || temperature > 1.0) {
      return NextResponse.json(
        { error: "Temperature must be between 0.1 and 1.0" },
        { status: 400 }
      );
    }

    // Validate top_p
    if (top_p < 0.1 || top_p > 1.0) {
      return NextResponse.json(
        { error: "top_p must be between 0.1 and 1.0" },
        { status: 400 }
      );
    }

    // Call JARVIS TTS server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TTS_SERVER_TIMEOUT);

    try {
      const response = await fetch(`${TTS_SERVER_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed, temperature, top_p }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS server error: ${errorText}`);
      }

      // Get WAV audio data
      const buffer = Buffer.from(await response.arrayBuffer());
      const duration = response.headers.get("X-Audio-Duration") || "0";

      // Return as WAV audio
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": buffer.length.toString(),
          "X-Audio-Duration": duration,
          "X-TTS-Provider": "bettany",
        },
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "TTS server timeout (60s)" },
          { status: 504 }
        );
      }
      
      if (fetchError.message?.includes("ECONNREFUSED")) {
        return NextResponse.json(
          { 
            error: "JARVIS TTS server not running",
            details: `Cannot connect to ${TTS_SERVER_URL}. Start the server with:\n` +
                    `/Users/mac_m3/Projects/voice_training/venv/bin/python /Users/mac_m3/Projects/voice_training/jarvis_tts_server.py`
          },
          { status: 503 }
        );
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error("[Bettany TTS] Error:", error);
    return NextResponse.json(
      { error: error.message || "TTS synthesis failed" },
      { status: 500 }
    );
  }
}
