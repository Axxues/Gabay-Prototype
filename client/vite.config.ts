import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function fileUploadPlugin(): Plugin {
  return {
    name: 'vite-plugin-file-upload',
    configureServer(server) {
      server.middlewares.use('/api/upload', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks);
            let filename = `file_${Date.now()}`;
            let fileBuffer: Buffer;

            const contentType = req.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
              const json = JSON.parse(body.toString('utf-8'));
              filename = json.filename || filename;
              filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
              const dataUrl = json.dataUrl || '';
              const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
              fileBuffer = Buffer.from(base64Data, 'base64');
            } else {
              const rawName = (req.headers['x-filename'] as string) || filename;
              filename = decodeURIComponent(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
              fileBuffer = body;
            }

            // Write into client/public/uploads: Vite dev server serves public files
            // directly at /uploads/filename without requiring an Express static mount.
            const candidates = [
              path.resolve(process.cwd(), 'public/uploads'),
              path.resolve(process.cwd(), 'client/public/uploads'),
            ];
            const uploadsDir =
              candidates.find(dir => fs.existsSync(dir)) ?? candidates[0];
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const filePath = path.join(uploadsDir, filename);
            fs.writeFileSync(filePath, fileBuffer);

            const publicUrl = `/uploads/${filename}`;
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                success: true,
                filename,
                url: publicUrl,
                size: fileBuffer.length
              })
            );
          } catch (err: any) {
            console.error('Local upload middleware error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Failed to save file' }));
          }
        });
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), fileUploadPlugin()],
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
      '/api': 'http://localhost:4001',
      '/likha': {
        target: 'https://gabay.zyberlab.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/likha/, ''),
      },
    },
  },
});
