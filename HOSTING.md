# 🌱 Smart Ceylon Greenhouse IoT & AI Platform - Self-Hosting Guide

This application is a full-stack, production-ready IoT monitoring and AI pathology analysis platform built with **React 19, TypeScript, Tailwind CSS, Express.js**, and **Google GenAI**.

---

## 🚀 Quick Start: Deploying to Your Custom Web Server

### Option 1: Docker / Docker Compose (Recommended)

1. Ensure Docker & Docker Compose are installed on your server.
2. Clone or extract the repository onto your server.
3. Run:
```bash
docker compose up -d --build
```
Your dashboard and API will be running on `http://YOUR_SERVER_IP:3000`.

---

### Option 2: Linux VPS / Raspberry Pi (Ubuntu/Debian with Node.js)

1. Install Node.js 20+ and PM2:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

2. Install dependencies & build production bundle:
```bash
npm install
npm run build
```

3. Start server with PM2:
```bash
pm2 start dist/server.cjs --name "smart-greenhouse"
pm2 save
pm2 startup
```

---

### Option 3: Render (free, no credit card — recommended if you want $0 hosting)

Render's free web service tier needs no payment card: 750 free hours/month,
512 MB RAM, shared CPU. It sleeps after 15 minutes with no traffic and takes
30-50 seconds to wake back up on the next request — fine for a hobby
greenhouse, since your ESP32 posting every few seconds keeps it awake
whenever it's actually connected.

This repo needs no code changes to deploy here — `server.ts` already serves
both the built frontend *and* every `/api/*` route (telemetry, AI features,
ESP32-CAM) from one Node process, which is exactly what Render expects. It
also already reads the `PORT` Render assigns via environment variable, so
you don't need to configure that yourself.

1. Push this repo to a GitHub repository (Render deploys from a Git repo).
2. Go to [render.com](https://render.com) → sign up (email/GitHub login — no
   card needed) → **New +** → **Web Service** → connect your repo.
3. Configure it:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - (Leave **Port** alone — Render sets `$PORT` automatically and the app
     now reads it.)
4. Under **Environment Variables**, add `GEMINI_API_KEY` with your key if
   you want the AI features (leave it out and those routes fall back to
   simulated demo responses — everything else, including real telemetry,
   works either way).
5. Deploy. Render gives you a URL like `https://your-app.onrender.com` —
   point your ESP32's `SERVER_ENDPOINT` at
   `https://your-app.onrender.com/api/telemetry`.

Firestore (used for the real sensor history in Reports/Dashboard) stays on
Firebase's free **Spark** plan for this — no card needed there either. You
only need Firebase's paid Blaze plan if you specifically want to run the
API as a *Firebase Cloud Function* (Option 4 below); hosting the same API
on Render instead avoids that entirely.

**Alternative**: [Koyeb](https://koyeb.com) also has a no-card free tier
(1 free web service, 0.1 vCPU / 512 MB RAM) with the same Node
Build/Start command setup as above.

---

### Option 4: Firebase Hosting + Cloud Functions (requires a card on file — skip this if you want $0 hosting; use Option 3 instead)

> Firebase Cloud Functions requires enabling the Blaze (pay-as-you-go) plan,
> which requires a payment card even though the free-tier usage itself is
> normally $0. If you'd rather not add a card anywhere, use **Option 3
> (Render)** above — it hosts the identical API for free with no card, and
> the Firestore database this app uses stays on the free Spark plan either
> way.

This repo already ships `firebase.json` set up to run **both** pieces on your
Firebase project — the static frontend on Hosting, and the `/api/**` Express
routes (telemetry ingestion, AI analysis, chatbot, ESP32-CAM, firmware code)
as a Cloud Function that Hosting transparently rewrites to. This is what
makes the ESP32's `POST /api/telemetry` calls actually reach your hosted
domain instead of 404ing.

**Important:** deploying with `firebase deploy` after only running
`vite build` (i.e. just `firebase deploy --only hosting`) publishes the
static site *without* the API — the dashboard will look right but every
reading will stay at zero forever, even with hardware connected, because
there is nothing to POST to. Deploy functions too.

1. Install the Firebase CLI and log in (one-time):
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. Cloud Functions requires the **Blaze (pay-as-you-go)** plan — enable it
   for this project in the [Firebase console](https://console.firebase.google.com/project/greenhouse-automation-sy-16089/usage/details).
   The free tier it includes is generous for a hobby greenhouse (2M
   invocations/month); you won't be billed unless you go well past that.
3. Store your Gemini key as a Functions secret (one-time; skip if you don't
   use the AI features):
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
4. Deploy everything:
   ```bash
   npm run build
   firebase deploy
   ```
   (`firebase deploy` runs Hosting *and* Functions together; the Functions
   `predeploy` hook in `firebase.json` builds `functions-dist/index.cjs`
   from `functions-entry.ts` + `api.ts` automatically.)
5. Point your ESP32's `SERVER_ENDPOINT` at
   `https://<your-project-id>.web.app/api/telemetry` (or your custom
   domain) — the `/api/firmware/esp32` route on your hosted site will
   already generate this URL correctly for you.

## 🔌 Connecting Physical ESP32 Hardware to Your Server

1. Open the Arduino sketch (`/api/firmware/esp32` or via the **Connect Real Hardware** modal on the dashboard).
2. Update the `SERVER_ENDPOINT` URL to your new server's address:
```cpp
// For local network / LAN:
const char* SERVER_ENDPOINT = "http://192.168.1.100:3000/api/telemetry";

// For public VPS / domain with SSL:
const char* SERVER_ENDPOINT = "https://greenhouse.yourdomain.com/api/telemetry";
```
3. Flash the code to your ESP32. As soon as the microcontroller boots and connects to WiFi, it will POST live temperature, humidity, soil moisture, light, and NPK readings to your server!
