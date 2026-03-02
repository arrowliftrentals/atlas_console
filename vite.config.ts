import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  server: {
    port: 3001, // Vite dev server
    proxy: {
      // Proxy API requests directly to Atlas backend
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Proxy /v1 API endpoints (HTTP and WebSocket)
      '/v1': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for /v1/telemetry/stream
      },
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large dependencies into separate chunks
          three: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          cytoscape: ['cytoscape', 'cytoscape-cola', 'cytoscape-dagre', 'cytoscape-elk', 'cytoscape-klay'],
          reactflow: ['reactflow'],
        },
      },
    },
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
  },
});
