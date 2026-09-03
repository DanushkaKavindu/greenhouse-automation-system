// One-time backfill: seeds realistic sample sensor readings into the SAME
// real Firestore collection (sensor_readings_log) that the ESP32's real
// telemetry writes to, and that the calendar's daily-average card, the
// Reports charts, and the CSV export all read from. Once this has run,
// those dates just work like any other real logged day — nothing else in
// the app needs to change.
//
// Run this from the project root, on a machine with normal internet access
// (your own computer, not a sandboxed shell):
//
//   node scripts/seed-sample-data.mjs           # writes to Firestore
//   node scripts/seed-sample-data.mjs --dry-run # just prints a preview, no writes
//
// Covers: 2026-08-27 21:37 -> 2026-09-01 06:22 (Asia/Colombo time), one
// reading every 15 minutes -- air temperature, humidity, soil moisture and
// solar (light) lux, following believable day/night and irrigation cycles.
// nitrogen/phosphorus/potassium and fan/pump/light relay states are filled
// in too since every real reading has them, but were not the focus of this
// request and are kept close to a realistic steady baseline.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  writeBatch,
  doc,
  Timestamp,
} from 'firebase/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const SENSOR_LOG_COLLECTION = 'sensor_readings_log';

// Sri Lanka local time (UTC+05:30) — matches the app's own day-boundary
// logic (dayRangeMs in src/utils/telemetry.ts) and how a Colombo-based
// browser groups these timestamps into calendar dates.
const TZ_OFFSET = '+05:30';
const START = new Date(`2026-08-27T21:37:00${TZ_OFFSET}`).getTime();
const END = new Date(`2026-09-01T06:22:00${TZ_OFFSET}`).getTime();
const STEP_MS = 15 * 60 * 1000; // one reading every 15 minutes

function hourOfDayColombo(ms) {
  const shifted = ms + 5.5 * 60 * 60 * 1000;
  const d = new Date(shifted);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

function round(n, dp = 1) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function jitter(spread) {
  return (Math.random() * 2 - 1) * spread;
}

// --- Diurnal models ---------------------------------------------------

function tempAt(hour) {
  // Peak ~34C around 14:00, trough ~23C around 02:00.
  const base = 28.5 + 5.5 * Math.cos(((hour - 14) / 24) * 2 * Math.PI);
  return round(base + jitter(0.4), 1);
}

function humidityAt(hour, temp) {
  // Roughly inverse of the temp curve: ~55% at 14:00, ~92% at 02:00.
  const base = 73.5 - 18.5 * Math.cos(((hour - 14) / 24) * 2 * Math.PI);
  const tempAdj = (28.5 - temp) * 0.6;
  return round(Math.min(95, Math.max(48, base + tempAdj + jitter(1.5))), 1);
}

function luxAt(hour, cloudFactor) {
  // Night baseline ~45-60 lux (matches the real LDR's dark-reading floor),
  // ramps up 06:00-08:00, peaks near midday, ramps down 16:30-18:30.
  const sunrise = 6.0;
  const sunset = 18.5;
  if (hour < sunrise || hour > sunset) {
    return Math.round(50 + jitter(8));
  }
  const span = sunset - sunrise;
  const x = (hour - sunrise) / span;
  const shaped = Math.sin(Math.PI * x);
  const peak = 1050;
  const value = 50 + (peak - 50) * shaped * cloudFactor;
  return Math.round(Math.max(45, value + jitter(15)));
}

// --- Soil moisture irrigation-cycle simulation -------------------------
let soil = 68;
let irrigationTicksLeft = 0;

function nextSoil(temp) {
  if (irrigationTicksLeft > 0) {
    soil = Math.min(82, soil + 6 + jitter(1));
    irrigationTicksLeft -= 1;
    return { soil: round(soil, 1), pump: true };
  }
  const dryRate = 0.35 + Math.max(0, (temp - 28) * 0.05);
  soil = Math.max(30, soil - dryRate - jitter(0.15));
  if (soil <= 40) {
    irrigationTicksLeft = 3; // pump runs ~3 ticks (~45 min) once triggered
  }
  return { soil: round(soil, 1), pump: irrigationTicksLeft > 0 };
}

// --- NPK: slow-moving, near-constant baseline --------------------------
let n = 160, p = 45, k = 200;
function nextNpk() {
  n = Math.max(120, Math.min(200, n + jitter(1.2)));
  p = Math.max(30, Math.min(60, p + jitter(0.6)));
  k = Math.max(160, Math.min(240, k + jitter(1.5)));
  return { nitrogen: Math.round(n), phosphorus: Math.round(p), potassium: Math.round(k) };
}

// --- Build the full reading series --------------------------------------

const readings = [];
let cloudFactor = 1;
for (let ts = START; ts <= END; ts += STEP_MS) {
  const hour = hourOfDayColombo(ts);

  if (Math.random() < 0.04) cloudFactor = 0.55 + Math.random() * 0.3;
  if (Math.random() < 0.08) cloudFactor = Math.min(1, cloudFactor + 0.15);

  const temp = tempAt(hour);
  const humidity = humidityAt(hour, temp);
  const lightIntensity = luxAt(hour, cloudFactor);
  const { soil: soilMoisture, pump: pumpStatus } = nextSoil(temp);
  const { nitrogen, phosphorus, potassium } = nextNpk();
  const fanStatus = temp > 31;
  const lightStatus = lightIntensity < 120;

  readings.push({
    temperature: temp,
    humidity,
    soilMoisture,
    lightIntensity,
    nitrogen,
    phosphorus,
    potassium,
    fanStatus,
    pumpStatus,
    lightStatus,
    ts,
  });
}

console.log(
  `Generated ${readings.length} readings from ${new Date(START).toISOString()} to ${new Date(END).toISOString()} (every 15 min)`
);
console.log('Sample rows:');
for (const r of [readings[0], readings[Math.floor(readings.length / 2)], readings[readings.length - 1]]) {
  console.log(
    `  ${new Date(r.ts).toLocaleString('en-US', { timeZone: 'Asia/Colombo' })} — ` +
      `temp ${r.temperature}C, humidity ${r.humidity}%, soil ${r.soilMoisture}%, lux ${r.lightIntensity}`
  );
}

if (DRY_RUN) {
  console.log('\n--dry-run: no data was written. Re-run without the flag to write to Firestore.');
  process.exit(0);
}

async function seed() {
  const configPath = path.join(projectRoot, 'firebase-applet-config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const app = initializeApp(config);
  // Force HTTP long-polling instead of raw gRPC streams — safer default in
  // case of a restrictive network/firewall/proxy.
  const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });

  const chunkSize = 450; // Firestore batch write limit is 500
  let written = 0;
  for (let i = 0; i < readings.length; i += chunkSize) {
    const chunk = readings.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const r of chunk) {
      const ref = doc(collection(db, SENSOR_LOG_COLLECTION));
      batch.set(ref, { ...r, ts: Timestamp.fromMillis(r.ts) });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`Committed ${written}/${readings.length}`);
  }
  console.log('Done — sample data is now in sensor_readings_log.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
