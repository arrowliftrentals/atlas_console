#!/usr/bin/env node
/*
  Minimal ElevenLabs Realtime WS proxy.
  - Client connects to ws://127.0.0.1:8787/?model_id=scribe_v2_realtime&audio_format=pcm_16000&commit_strategy=vad&vad_silence_threshold_secs=0.8
  - Proxy connects upstream to wss://api.elevenlabs.io/v1/speech-to-text/realtime with `xi-api-key` header from ELEVENLABS_API_KEY
  - Forwards messages both ways, keeps heartbeats alive, logs concise info only on errors.
*/

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.ELEVEN_WS_PROXY_PORT ? Number(process.env.ELEVEN_WS_PROXY_PORT) : 8787;
const XI_KEY = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
if (!XI_KEY) {
  console.error('[WS-PROXY] ELEVENLABS_API_KEY missing in env');
}

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  // Accept all upgrades; in real deployments you may add auth here
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (client, req) => {
  try {
    const upstreamUrl = new URL('wss://api.elevenlabs.io/v1/speech-to-text/realtime');
    // forward query params from client (model_id, audio_format, etc.)
    const q = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    q.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

    const upstream = new WebSocket(upstreamUrl.toString(), {
      headers: { 'xi-api-key': XI_KEY },
    });

    const closeBoth = (code, reason) => {
      if (client.readyState === WebSocket.OPEN) client.close(code, reason);
      if (upstream.readyState === WebSocket.OPEN) upstream.close(code, reason);
    };

    upstream.on('open', () => {
      client.send(JSON.stringify({ message_type: 'proxy_status', status: 'connected' }));
    });

    upstream.on('message', (data) => {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    });

    upstream.on('error', (err) => {
      console.error('[WS-PROXY] Upstream error:', err.message);
      closeBoth(1011, 'upstream_error');
    });

    upstream.on('close', (code, reason) => {
      if (client.readyState === WebSocket.OPEN) client.close(code, reason);
    });

    client.on('message', (data) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
    });

    client.on('error', (err) => {
      console.error('[WS-PROXY] Client error:', err.message);
      closeBoth(1011, 'client_error');
    });

    client.on('close', (code, reason) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.close(code, reason);
    });
  } catch (e) {
    console.error('[WS-PROXY] Fatal connection error:', e.message);
    try { client.close(1011, 'proxy_fatal'); } catch {}
  }
});

server.listen(PORT, () => {
  console.log(`[WS-PROXY] ElevenLabs Realtime proxy listening on ws://127.0.0.1:${PORT}`);
});
