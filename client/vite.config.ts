import https from 'node:https';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('/react/') || id.endsWith('/react')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('pdfjs-dist')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('mammoth')) {
              return 'vendor-docx';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/rag': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rag/, '/api'),
      },
      '/likha': {
        target: 'https://gabay.zyberlab.com',
        changeOrigin: true,
        secure: true,
        agent: new https.Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 50 }),
        rewrite: (path) => path.replace(/^\/likha/, ''),
      },
    },
  },
});
