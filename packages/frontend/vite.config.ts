import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('@uiw/react-codemirror') ||
            id.includes('@codemirror')
          ) {
            return 'codemirror';
          }

          if (id.includes('@dnd-kit')) {
            return 'dnd-kit';
          }

          if (id.includes('@radix-ui') || id.includes('lucide-react')) {
            return 'radix';
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('react-router')
          ) {
            return 'react-vendor';
          }

          if (id.includes('/axios/')) {
            return 'network';
          }

          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform/resolvers')
          ) {
            return 'forms';
          }

          if (id.includes('@tanstack/react-table')) {
            return 'table';
          }

          return undefined;
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: process.env.VITE_PORT ? Number(process.env.VITE_PORT) : 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
