// Standalone Node server entry point — for Docker / a VPS / Render / a
// Raspberry Pi (see HOSTING.md). The actual API routes live in api.ts,
// shared with the Firebase Cloud Function entry (functions-entry.ts) so
// both deployment paths run identical logic.
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import app from './api';

// Render/Railway/Koyeb/most free hosts assign their own port via $PORT —
// binding to a hardcoded 3000 would make the app unreachable there.
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // In development mode, mount Vite as middleware so Hot Module Replacement and preview works perfectly
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve pre-built static build folder in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Greenhouse Server running on port ${PORT}`);
  });
}

startServer();
