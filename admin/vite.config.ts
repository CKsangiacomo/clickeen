import { defineConfig } from 'vite';
import path from 'node:path';
import { spawn } from 'node:child_process';

export default defineConfig({
  resolve: {
    alias: {
      '@dieter': path.resolve(__dirname, '../dieter'),
    },
  },
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    },
  },
  plugins: [
    {
      name: 'rebuild-icons-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/rebuild-icons' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');

            const rebuildScript = path.resolve(__dirname, '..', 'scripts', 'rebuild-icons.js');
            const child = spawn('node', [rebuildScript], {
              cwd: path.resolve(__dirname, '..'),
            });

            let output = '';
            let errorOutput = '';

            child.stdout?.on('data', (data) => {
              output += data.toString();
              console.log(data.toString());
            });

            child.stderr?.on('data', (data) => {
              errorOutput += data.toString();
              console.error(data.toString());
            });

            child.on('close', (code) => {
              if (code === 0) {
                res.end(JSON.stringify({ success: true, output }));
              } else {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: errorOutput || output }));
              }
            });

            child.on('error', (error) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: error.message }));
            });
          } else {
            next();
          }
        });
      },
    },
  ],
});
