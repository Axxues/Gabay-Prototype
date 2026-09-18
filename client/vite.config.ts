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

            // Write into server/uploads: that is the directory the backend
            // serves at /uploads (see server/src/index.ts), and Vite proxies
            // /uploads to the backend — so files written to client/public
            // would 404. Supports vite being run from client/ or repo root.
            const candidates = [
              path.resolve(process.cwd(), '../server/uploads'),
              path.resolve(process.cwd(), 'server/uploads'),
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
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
