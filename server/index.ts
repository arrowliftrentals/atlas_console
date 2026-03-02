import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ATLAS_API_URL = process.env.ATLAS_API_URL || 'http://127.0.0.1:8000';
const ATLAS_WS_URL = ATLAS_API_URL.replace(/^http/, 'ws');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'atlas-console', atlas_backend: ATLAS_API_URL });
});

// HTTP API proxy - forward all /api/* and /v1/* requests to Atlas backend
app.use('/api', createProxyMiddleware({
  target: ATLAS_API_URL,
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error(`[Proxy Error] ${req.method} ${req.url}:`, err.message);
    (res as express.Response).status(502).json({ 
      error: 'Backend unavailable', 
      message: err.message 
    });
  },
  onProxyReq: (proxyReq, req) => {
    console.log(`[HTTP Proxy] ${req.method} ${req.url} → ${ATLAS_API_URL}${req.url}`);
  },
}));

app.use('/v1', createProxyMiddleware({
  target: ATLAS_API_URL,
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error(`[Proxy Error] ${req.method} ${req.url}:`, err.message);
    (res as express.Response).status(502).json({ 
      error: 'Backend unavailable', 
      message: err.message 
    });
  },
  onProxyReq: (proxyReq, req) => {
    console.log(`[HTTP Proxy] ${req.method} ${req.url} → ${ATLAS_API_URL}${req.url}`);
  },
}));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  
  // SPA fallback - serve index.html for all unmatched routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Create HTTP server
const server = createServer(app);

// WebSocket proxy setup
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { url } = request;
  
  console.log(`[WS Upgrade] ${url}`);
  
  // Only proxy WebSocket connections to specific paths
  if (url?.startsWith('/v1/telemetry/stream') ||
      url?.startsWith('/v1/progress/stream') ||
      url?.startsWith('/api/analysis/ws')) {
    
    // Create WebSocket connection to backend
    const backendUrl = `${ATLAS_WS_URL}${url}`;
    console.log(`[WS Proxy] ${url} → ${backendUrl}`);
    
    const backendWs = new WebSocket(backendUrl);
    
    wss.handleUpgrade(request, socket, head, (clientWs) => {
      // Forward messages: client → backend
      clientWs.on('message', (data) => {
        if (backendWs.readyState === WebSocket.OPEN) {
          backendWs.send(data);
        }
      });
      
      // Forward messages: backend → client
      backendWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });
      
      // Handle backend connection open
      backendWs.on('open', () => {
        console.log(`[WS] Backend connected: ${url}`);
      });
      
      // Handle backend errors
      backendWs.on('error', (err) => {
        console.error(`[WS Error] Backend: ${url}:`, err.message);
        clientWs.close(1011, 'Backend error');
      });
      
      // Handle backend close
      backendWs.on('close', (code, reason) => {
        console.log(`[WS] Backend closed: ${url} (${code})`);
        clientWs.close(code, reason.toString());
      });
      
      // Handle client close
      clientWs.on('close', (code, reason) => {
        console.log(`[WS] Client closed: ${url} (${code})`);
        backendWs.close();
      });
      
      // Handle client errors
      clientWs.on('error', (err) => {
        console.error(`[WS Error] Client: ${url}:`, err.message);
        backendWs.close();
      });
    });
  } else {
    // Reject unknown WebSocket paths
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 ATLAS Console Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying HTTP to: ${ATLAS_API_URL}`);
  console.log(`🔌 Proxying WebSocket to: ${ATLAS_WS_URL}`);
  console.log(`\nEnvironment: ${process.env.NODE_ENV || 'development'}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
