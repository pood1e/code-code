import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@uiw/react-codemirror') || id.includes('@codemirror')) {
            return 'codemirror';
          }

          if (id.includes('@dnd-kit')) {
            return 'dnd-kit';
          }

          if (
            id.includes('/antd/') ||
            id.includes('@ant-design') ||
            id.includes('/rc-')
          ) {
            return 'antd';
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

          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
