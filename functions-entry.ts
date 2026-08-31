// Firebase Cloud Function entry point. This is what firebase.json's hosting
// rewrite for "/api/**" points at, so the SAME api.ts routes that run
// standalone (see server.ts / HOSTING.md) also run on your Firebase Hosting
// domain — this is what makes /api/telemetry actually work once deployed.
//
// Built by `npm run build:functions` into functions-dist/index.js (see
// package.json). Requires the GEMINI_API_KEY secret to be set once via:
//   firebase functions:secrets:set GEMINI_API_KEY
import { onRequest } from 'firebase-functions/v2/https';
import app from './api';

export const api = onRequest(
  {
    region: 'us-central1',
    secrets: ['GEMINI_API_KEY'],
    cors: true,
    memory: '512MiB',
  },
  app
);
