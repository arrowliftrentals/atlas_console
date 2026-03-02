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
      // Proxy API requests to Express server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy WebSocket to Express server
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
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
