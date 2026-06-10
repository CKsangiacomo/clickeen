import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { createDevstudioPlugins } from './vite/devstudio';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2000,
  },
  resolve: {
    alias: {
      '@dieter': path.resolve(__dirname, '../dieter'),
    },
  },
  server: {
    port: 5173,
    open: true,
    cors: false,
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    },
  },
  plugins: [
    ...createDevstudioPlugins(),
    {
      name: 'tokyo-static-widgets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          if (!url.startsWith('/tokyo/')) return next();

          const cleanPath = url.split('?')[0];
          const filePath = path.resolve(__dirname, '..', cleanPath.slice(1));

          fs.readFile(filePath, (err, data) => {
            if (err) {
              res.statusCode = 404;
              res.end('Not found');
              return;
            }

            const ext = path.extname(filePath);
            if (ext === '.json') {
              res.setHeader('Content-Type', 'application/json');
            } else if (ext === '.html') {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
            } else if (ext === '.css') {
              res.setHeader('Content-Type', 'text/css; charset=utf-8');
            } else if (ext === '.js') {
              res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
            }

            res.end(data);
          });
        });
      },
    },
  ],
});
