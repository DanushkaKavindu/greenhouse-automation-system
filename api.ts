import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// This file defines the greenhouse's Express API — every /api/* route
// (telemetry ingestion, AI plant analysis, ESP32-CAM, chatbot, firmware
// code generator). It has no opinion about how it's served: server.ts wraps
// it for a standalone Node/Docker/VPS deployment, and functions-entry.ts
// wraps it as a Firebase Cloud Function so the SAME API also runs behind
// Firebase Hosting on the hosted domain.

// Load environment variables
dotenv.config();

const app = express();

// Server-side Firestore handle, used to persist real ESP32 telemetry so the
// Reports page has actual history to read instead of fabricated numbers.
// Falls back to null (logging silently skipped) if Firebase isn't configured.
let serverDb: any = null;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'mock-api-key-for-compilation-only') {
    const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    serverDb = getFirestore(fbApp);
  }
} catch (e) {
  console.warn('Server-side Firestore init failed — telemetry history logging disabled:', e);
}

const SENSOR_LOG_COLLECTION = 'sensor_readings_log';

async function logSensorReading(reading: {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  lightIntensity: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  fanStatus: boolean;
  pumpStatus: boolean;
  lightStatus: boolean;
}) {
  if (!serverDb) return;
  try {
    // Keep a live "current reading" doc for real-time cross-device sync...
    await setDoc(doc(serverDb, 'sensor_telemetry', 'latest_reading'), {
      ...reading,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    // ...and append to the permanent history log Reports.tsx reads from.
    await addDoc(collection(serverDb, SENSOR_LOG_COLLECTION), {
      ...reading,
      ts: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to log sensor reading to Firestore:', (err as any)?.message || err);
  }
}

// 🤖 Chatbot tool: real historical sensor lookup (Gemini function calling).
// Lets the chatbot answer "what was the temperature yesterday / on 2026-08-20 /
// this week's average" from ACTUAL logged readings instead of guessing —
// mirrors the same sensor_readings_log data and day-boundary convention the
// Dashboard/Reports pages use (see src/utils/telemetry.ts's dayRangeMs).
const getSensorHistoryDeclaration = {
  name: 'get_sensor_history',
  description:
    "Fetches REAL logged greenhouse sensor readings (averages, min, max, sample count) for a specific past date or date range, computed from actual ESP32 telemetry stored in the database. Call this whenever the user asks about a sensor value, average, or condition for 'today's average', 'yesterday', a named/specific date, 'this week', or any period other than the live right-now reading already given to you. Never guess or estimate a historical number without calling this first.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      startDate: { type: Type.STRING, description: 'Start date, inclusive, formatted YYYY-MM-DD.' },
      endDate: { type: Type.STRING, description: 'End date, inclusive, formatted YYYY-MM-DD. Same as startDate for a single day.' },
    },
    required: ['startDate', 'endDate'],
  },
};

async function runGetSensorHistory(startDateStr: string, endDateStr: string) {
  try {
    const startMs = new Date(`${startDateStr}T00:00:00`).getTime();
    const endMs = new Date(`${endDateStr}T00:00:00`).getTime() + 24 * 60 * 60 * 1000;
    if (!serverDb || Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return { hasData: false, sampleCount: 0, note: 'Sensor history is not available on this server right now.' };
    }

    const readingsRef = collection(serverDb, SENSOR_LOG_COLLECTION);
    const q = query(
      readingsRef,
      where('ts', '>=', Timestamp.fromMillis(startMs)),
      where('ts', '<', Timestamp.fromMillis(endMs)),
      orderBy('ts', 'asc'),
      limit(5000)
    );
    const snap = await getDocs(q);
    const readings = snap.docs.map((d) => d.data() as any);

    if (!readings.length) {
      return {
        hasData: false,
        sampleCount: 0,
        startDate: startDateStr,
        endDate: endDateStr,
        note: 'No sensor readings were logged for this date range — the hardware may not have been connected then.',
      };
    }

    const nums = (key: string) => readings.map((r) => Number(r[key]) || 0);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const round1 = (n: number) => Math.round(n * 10) / 10;

    return {
      hasData: true,
      startDate: startDateStr,
      endDate: endDateStr,
      sampleCount: readings.length,
      avgTemperatureC: round1(avg(nums('temperature'))),
      minTemperatureC: round1(Math.min(...nums('temperature'))),
      maxTemperatureC: round1(Math.max(...nums('temperature'))),
      avgHumidityPct: round1(avg(nums('humidity'))),
      avgSoilMoisturePct: round1(avg(nums('soilMoisture'))),
      avgLightLux: Math.round(avg(nums('lightIntensity'))),
      avgNitrogenMgKg: Math.round(avg(nums('nitrogen'))),
      avgPhosphorusMgKg: Math.round(avg(nums('phosphorus'))),
      avgPotassiumMgKg: Math.round(avg(nums('potassium'))),
    };
  } catch (err: any) {
    console.warn('get_sensor_history tool failed:', err?.message || err);
    return { hasData: false, sampleCount: 0, error: 'Failed to query sensor history.' };
  }
}

// Increase JSON payload limits to support base64 images
app.use(express.json({ limit: '15mb' }));

// Initialize GoogleGenAI client utility server-side
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not defined in environment secrets. AI routes will run in mock simulation fallback mode.');
}

const ai = new GoogleGenAI({
  apiKey: apiKey || 'MOCK_KEY',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// 🌿 AI Plant Leaf Disease Detection Route
app.post('/api/disease-detect', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Missing image data.' });
    }

    // Fallback Mock response if API key is not present
    if (!apiKey) {
      console.log('Using simulated offline diagnostic response...');
      // Cycle through typical Chilli infections for a fun realistic demo
      const simulations = [
        {
          diseaseName: 'Chilli Leaf Curl Virus',
          confidence: 88,
          severity: 'Warning',
          treatment: [
            'Rogue and burn heavily infected plants immediately.',
            'Apply organic neem oil spray (5ml per Litre) to manage whitefly vectors.'
          ],
          preventive: [
            'Establish yellow sticky traps across the greenhouse perimeter.',
            'Maintain vector-proof fine nylon mesh nets over ventilation vents.'
          ]
        },
        {
          diseaseName: 'Anthracnose (Colletotrichum)',
          confidence: 94,
          severity: 'Critical',
          treatment: [
            'Prune and destroy infected chilli fruits showing sunken lesions.',
            'Apply copper-based organic fungicides during early morning intervals.'
          ],
          preventive: [
            'Maintain dry foliage (avoid overhead watering - prefer drip irrigation).',
            'Ensure adequate plant spacing of at least 45cm to promote air circulation.'
          ]
        }
      ];
      const selected = simulations[Math.floor(Math.random() * simulations.length)];
      return res.json(selected);
    }

    // Call real Gemini Vision model
    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: image,
      },
    };

    const textPart = {
      text: 'Analyze this plant leaf photo carefully for any diseases or deficiencies, specifically looking for common Ceylon chilli pests, leaf curl virus, anthracnose, leaf spot, nitrogen deficiency, or water stress. Diagnose it and fill in the structured response object.',
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diseaseName: { type: Type.STRING, description: 'Specific disease name or "Healthy Green Chilli Plant"' },
            confidence: { type: Type.INTEGER, description: 'Confidence index as integer percentage between 0 and 100' },
            severity: { type: Type.STRING, description: 'Severity level: Healthy, Warning, or Critical' },
            treatment: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: 'List of specific treatment or management guidelines' 
            },
            preventive: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: 'List of preventive maintenance recommendations' 
            },
          },
          required: ['diseaseName', 'confidence', 'severity', 'treatment', 'preventive'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json(parsedData);

  } catch (err: any) {
    console.error('Error in disease detection API:', err);
    return res.status(500).json({ error: 'AI pathological diagnostic failed.', details: err.message });
  }
});

// 🌿 AI Crop Growth Stage & Harvest Timeline Analysis Route
app.post('/api/crop-analysis', async (req, res) => {
  try {
    const { image, mimeType, cropType } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Missing image data.' });
    }

    // Fallback Mock response if API key is not present
    if (!apiKey) {
      console.log('Using simulated offline crop growth analysis...');
      
      // Select mock diagnostic values depending on cropType or random
      const stages = ['Seedling', 'Vegetative', 'Flowering', 'Fruiting'];
      const randomStage = stages[Math.floor(Math.random() * stages.length)];
      
      let estDays = 30;
      let observations = "The plant shows active leaf expansion and sturdy stem growth.";
      
      if (randomStage === 'Seedling') {
        estDays = 65;
        observations = "Foliage shows healthy cotyledon development and first true leaves. Stem turgidity is strong with excellent root anchorage.";
      } else if (randomStage === 'Vegetative') {
        estDays = 45;
        observations = "Dense vegetative cover with rich emerald-green foliage. Robust branching and nodes are preparing to support heavy flowering cycles.";
      } else if (randomStage === 'Flowering') {
        estDays = 25;
        observations = "Foliar node development is mature. Early blossom clusters are visible with active pollination vectors. No signs of stress or flower abortion.";
      } else if (randomStage === 'Fruiting') {
        estDays = 12;
        observations = "Vibrant crop showing active fruit set and pod development. High fruit count with optimal firmness and standard varietal size indicators.";
      }

      return res.json({
        detectedCropType: cropType || "MICH 2 (Green Chilli)",
        growthStage: randomStage,
        confidence: 94,
        healthScore: 92,
        estDaysToHarvest: estDays,
        visualObservations: `[Simulated] ${observations}`
      });
    }

    // Call real Gemini Vision model
    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: image,
      },
    };

    const textPart = {
      text: `Analyze this image of a greenhouse crop: "${cropType || 'Green Chilli'}". Identify its exact growth stage ('Seedling', 'Vegetative', 'Flowering', or 'Fruiting') and evaluate its overall health and physical maturity. Then, estimate the remaining days to harvest based on visible maturity and the typical lifecycle of this crop. Return a structured JSON response.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedCropType: { type: Type.STRING, description: 'The identified crop type or variety' },
            growthStage: { type: Type.STRING, description: 'Growth stage: Seedling, Vegetative, Flowering, or Fruiting' },
            confidence: { type: Type.INTEGER, description: 'Confidence index as integer percentage between 0 and 100' },
            healthScore: { type: Type.INTEGER, description: 'Overall plant health rating from 0 to 100' },
            estDaysToHarvest: { type: Type.INTEGER, description: 'Estimated remaining days until harvest begins' },
            visualObservations: { type: Type.STRING, description: 'Brief description of visual physical features, foliage quality, and flowering/fruiting progress' },
          },
          required: ['detectedCropType', 'growthStage', 'confidence', 'healthScore', 'estDaysToHarvest', 'visualObservations'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json(parsedData);

  } catch (err: any) {
    console.error('Error in crop analysis API:', err);
    return res.status(500).json({ error: 'AI crop timeline analysis failed.', details: err.message });
  }
});

// 📷 ESP32-CAM In-Memory State — starts empty. There is no simulated/demo
// frame: until a real ESP32-CAM (or the webcam/upload fallback) posts a
// photo to /api/esp32cam/upload, latestESP32Frame stays null and the
// frontend shows a "no camera connected" message instead of fake data.
let latestESP32Frame: any = null;
let esp32History: any[] = [];
// 📷 ESP32-CAM Upload Endpoint (Called by a real ESP32-CAM module, the
// browser webcam capture, or a manual file upload — all three post here)
app.post('/api/esp32cam/upload', async (req, res) => {
  try {
    const { image, mimeType, ipAddress, rssi, source } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided.' });
    }

    const clientIp = ipAddress || req.ip || null;

    let base64Image = image;
    let actualMime = mimeType || 'image/jpeg';

    if (image.startsWith('data:')) {
      const parts = image.split(',');
      actualMime = parts[0].match(/data:(.*?);/)?.[1] || 'image/jpeg';
      base64Image = parts[1];
    }

    let diseaseData: any = null;
    let growthData: any = null;

    // Run real Gemini Vision analysis when a server API key is configured.
    if (apiKey && base64Image) {
      try {
        const imagePart = {
          inlineData: { mimeType: actualMime, data: base64Image }
        };
        const textPart = {
          text: `Analyze this plant picture from an ESP32-CAM module in a greenhouse. 
1. Detect any plant disease or pests (Name, severity: Healthy/Warning/Critical, confidence %, treatment & preventive steps).
2. Measure plant growth: estimate plant height in centimeters, stem diameter in mm, leaf count, growth stage (Seedling, Vegetative, Flowering, Fruiting), health score (0-100), and days to harvest.`
        };

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                diseaseName: { type: Type.STRING },
                confidence: { type: Type.INTEGER },
                severity: { type: Type.STRING },
                symptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
                treatment: { type: Type.ARRAY, items: { type: Type.STRING } },
                preventive: { type: Type.ARRAY, items: { type: Type.STRING } },
                plantHeightCm: { type: Type.NUMBER },
                heightGrowthRate: { type: Type.NUMBER },
                stemDiameterMm: { type: Type.NUMBER },
                leafCount: { type: Type.INTEGER },
                growthStage: { type: Type.STRING },
                healthScore: { type: Type.INTEGER },
                estDaysToHarvest: { type: Type.INTEGER },
                observations: { type: Type.STRING },
              },
              required: ['diseaseName', 'confidence', 'severity', 'plantHeightCm', 'healthScore']
            }
          }
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.diseaseName) {
          diseaseData = {
            diseaseName: parsed.diseaseName,
            confidence: parsed.confidence || 90,
            severity: (parsed.severity === 'Critical' || parsed.severity === 'Warning') ? parsed.severity : 'Healthy',
            symptoms: parsed.symptoms || ['Inspected via ESP32-CAM lens'],
            treatment: parsed.treatment || ['Maintain standard irrigation'],
            preventive: parsed.preventive || ['Monitor daily frame captures'],
          };
        }
        if (parsed.plantHeightCm) {
          growthData = {
            plantHeightCm: parsed.plantHeightCm,
            heightGrowthRate: parsed.heightGrowthRate || 0,
            stemDiameterMm: parsed.stemDiameterMm || 0,
            leafCount: parsed.leafCount || 0,
            growthStage: (parsed.growthStage || 'Seedling') as any,
            healthScore: parsed.healthScore || 0,
            estDaysToHarvest: parsed.estDaysToHarvest || 0,
            observations: parsed.observations || 'Automated ESP32-CAM frame analysis completed.',
          };
        }
      } catch (geminiErr) {
        console.error('Gemini vision analysis error on ESP32 frame:', geminiErr);
      }
    }

    const analysisAvailable = !!(diseaseData && growthData);

    // No fabricated numbers: if there's no API key, or Gemini didn't return
    // a usable result, say so honestly instead of inventing a diagnosis.
    if (!diseaseData) {
      diseaseData = {
        diseaseName: 'AI Analysis Unavailable',
        confidence: 0,
        severity: 'Unknown',
        symptoms: apiKey
          ? ['Gemini could not analyze this image — see server logs.']
          : ['GEMINI_API_KEY is not configured on the server.'],
        treatment: [],
        preventive: [],
      };
    }
    if (!growthData) {
      growthData = {
        plantHeightCm: 0,
        heightGrowthRate: 0,
        stemDiameterMm: 0,
        leafCount: 0,
        growthStage: 'Seedling',
        healthScore: 0,
        estDaysToHarvest: 0,
        observations: 'AI growth analysis unavailable — configure GEMINI_API_KEY to enable automatic measurements.',
      };
    }

    latestESP32Frame = {
      id: 'esp32_' + Date.now(),
      imageUrl: image,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isoTime: new Date().toISOString(),
      source: source || 'esp32_cam',
      ipAddress: clientIp,
      rssi: typeof rssi === 'number' ? rssi : null,
      resolution: '1600x1200 UXGA',
      fps: 15,
      disease: diseaseData,
      growth: growthData,
      analysisAvailable,
    };

    esp32History.unshift(latestESP32Frame);
    if (esp32History.length > 20) esp32History.pop();

    return res.json({
      status: 'success',
      message: analysisAvailable
        ? 'ESP32-CAM image received and analyzed successfully.'
        : 'Image received, but AI analysis is unavailable (no GEMINI_API_KEY configured).',
      frame: latestESP32Frame,
    });

  } catch (err: any) {
    console.error('Error processing ESP32-CAM upload:', err);
    return res.status(500).json({ error: 'ESP32-CAM frame processing failed.', details: err.message });
  }
});

// GET Latest ESP32-CAM Snapshot & Analysis — frame is null until a real
// photo has been posted to /api/esp32cam/upload.
app.get('/api/esp32cam/latest', (req, res) => {
  return res.json({
    status: latestESP32Frame ? 'online' : 'offline',
    frame: latestESP32Frame,
    totalFramesCaptured: esp32History.length,
  });
});

// GET ESP32-CAM Capture History (real captures only — empty until the first upload)
app.get('/api/esp32cam/history', (req, res) => {
  return res.json({
    history: esp32History,
  });
});

// 🌐 Real Physical Greenhouse IoT Telemetry In-Memory Store
interface HardwareTelemetryState {
  isHardwareConnected: boolean;
  lastHeartbeat: string | null;
  sensorData: {
    temperature: number;
    humidity: number;
    soilMoisture: number;
    lightIntensity: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    growthStage?: string;
    healthScore?: number;
    timestamp: string;
  };
  actuators: {
    fanStatus: boolean;
    pumpStatus: boolean;
    lightStatus: boolean;
    autoMode: boolean;
  };
  thresholds: {
    tempHigh: number;
    tempLow: number;
    soilLow: number;
    soilHigh: number;
    lightLow: number;
    lightHigh: number;
    nitrogenLow: number;
    nitrogenHigh: number;
    phosphorusLow: number;
    phosphorusHigh: number;
    potassiumLow: number;
    potassiumHigh: number;
  };
}

// Real greenhouse state, in-memory. Everything starts at zero — these are
// REAL sensor fields, not demo placeholders, and only change once an actual
// ESP32 POSTs a reading to /api/telemetry below.
let greenhouseHardwareState: HardwareTelemetryState = {
  isHardwareConnected: false,
  lastHeartbeat: null,
  sensorData: {
    temperature: 0,
    humidity: 0,
    soilMoisture: 0,
    lightIntensity: 0,
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0,
    growthStage: 'Seedling',
    healthScore: 0,
    timestamp: '',
  },
  actuators: {
    fanStatus: false,
    pumpStatus: false,
    lightStatus: false,
    autoMode: true,
  },
  thresholds: {
    tempHigh: 32,
    tempLow: 26,
    soilLow: 40,
    soilHigh: 70,
    lightLow: 300,
    lightHigh: 800,
    nitrogenLow: 130,
    nitrogenHigh: 210,
    phosphorusLow: 30,
    phosphorusHigh: 65,
    potassiumLow: 150,
    potassiumHigh: 260,
  },
};

// 📡 POST /api/telemetry - Endpoint called by Physical ESP32 / Arduino / Raspberry Pi Greenhouse Controller
app.post('/api/telemetry', async (req, res) => {
  try {
    const { 
      temperature, 
      humidity, 
      soilMoisture, 
      lightIntensity, 
      nitrogen, 
      phosphorus, 
      potassium, 
      fanStatus, 
      pumpStatus, 
      lightStatus 
    } = req.body;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    greenhouseHardwareState.isHardwareConnected = true;
    greenhouseHardwareState.lastHeartbeat = now.toISOString();

    if (temperature !== undefined) greenhouseHardwareState.sensorData.temperature = parseFloat(Number(temperature).toFixed(1));
    if (humidity !== undefined) greenhouseHardwareState.sensorData.humidity = parseFloat(Number(humidity).toFixed(1));
    if (soilMoisture !== undefined) greenhouseHardwareState.sensorData.soilMoisture = Math.round(Number(soilMoisture));
    if (lightIntensity !== undefined) greenhouseHardwareState.sensorData.lightIntensity = Math.round(Number(lightIntensity));
    if (nitrogen !== undefined) greenhouseHardwareState.sensorData.nitrogen = Math.round(Number(nitrogen));
    if (phosphorus !== undefined) greenhouseHardwareState.sensorData.phosphorus = Math.round(Number(phosphorus));
    if (potassium !== undefined) greenhouseHardwareState.sensorData.potassium = Math.round(Number(potassium));
    greenhouseHardwareState.sensorData.timestamp = timeStr;

    // If hardware is reporting its actual physical relay switch state:
    if (fanStatus !== undefined) greenhouseHardwareState.actuators.fanStatus = Boolean(fanStatus);
    if (pumpStatus !== undefined) greenhouseHardwareState.actuators.pumpStatus = Boolean(pumpStatus);
    if (lightStatus !== undefined) greenhouseHardwareState.actuators.lightStatus = Boolean(lightStatus);

    // Persist this real reading so Reports/Dashboard history reflects actual
    // hardware data instead of fabricated demo numbers. Never blocks or
    // fails the ESP32's request if Firestore is unavailable.
    await logSensorReading({
      temperature: greenhouseHardwareState.sensorData.temperature,
      humidity: greenhouseHardwareState.sensorData.humidity,
      soilMoisture: greenhouseHardwareState.sensorData.soilMoisture,
      lightIntensity: greenhouseHardwareState.sensorData.lightIntensity,
      nitrogen: greenhouseHardwareState.sensorData.nitrogen,
      phosphorus: greenhouseHardwareState.sensorData.phosphorus,
      potassium: greenhouseHardwareState.sensorData.potassium,
      fanStatus: greenhouseHardwareState.actuators.fanStatus,
      pumpStatus: greenhouseHardwareState.actuators.pumpStatus,
      lightStatus: greenhouseHardwareState.actuators.lightStatus,
    });

    return res.json({
      status: 'success',
      message: 'Greenhouse telemetry ingested successfully.',
      serverTime: now.toISOString(),
      commands: greenhouseHardwareState.actuators,
      thresholds: greenhouseHardwareState.thresholds,
    });
  } catch (err: any) {
    console.error('Error handling telemetry post:', err);
    return res.status(500).json({ error: 'Failed to ingest greenhouse telemetry', details: err.message });
  }
});

// 📡 GET /api/telemetry - Endpoint called by Dashboard UI or monitoring systems
app.get('/api/telemetry', (req, res) => {
  // Check if hardware heartbeat was within last 60 seconds
  const isAlive = greenhouseHardwareState.lastHeartbeat 
    ? (Date.now() - new Date(greenhouseHardwareState.lastHeartbeat).getTime()) < 60000 
    : false;

  return res.json({
    isHardwareConnected: isAlive,
    lastHeartbeat: greenhouseHardwareState.lastHeartbeat,
    sensorData: greenhouseHardwareState.sensorData,
    actuators: greenhouseHardwareState.actuators,
    thresholds: greenhouseHardwareState.thresholds,
  });
});

// 🎛️ POST /api/telemetry/actuators - Endpoint for Dashboard to toggle Relays and Automation
app.post('/api/telemetry/actuators', (req, res) => {
  const { fanStatus, pumpStatus, lightStatus, autoMode } = req.body;
  if (fanStatus !== undefined) greenhouseHardwareState.actuators.fanStatus = Boolean(fanStatus);
  if (pumpStatus !== undefined) greenhouseHardwareState.actuators.pumpStatus = Boolean(pumpStatus);
  if (lightStatus !== undefined) greenhouseHardwareState.actuators.lightStatus = Boolean(lightStatus);
  if (autoMode !== undefined) greenhouseHardwareState.actuators.autoMode = Boolean(autoMode);

  return res.json({
    status: 'success',
    actuators: greenhouseHardwareState.actuators,
  });
});

// 🎛️ POST /api/telemetry/thresholds - Endpoint for Dashboard to update Automation Thresholds
app.post('/api/telemetry/thresholds', (req, res) => {
  const newThresholds = req.body;
  greenhouseHardwareState.thresholds = {
    ...greenhouseHardwareState.thresholds,
    ...newThresholds,
  };
  return res.json({
    status: 'success',
    thresholds: greenhouseHardwareState.thresholds,
  });
});

// 📄 GET /api/firmware/esp32 - Ready-to-Flash C++ Code for ESP32 Main Greenhouse Controller
app.get('/api/firmware/esp32', (req, res) => {
  const host = req.get('host') || 'ais-pre-ztuwzwjna4dm2b5dui3z7k-717668214907.asia-southeast1.run.app';
  const protocol = req.protocol === 'https' || host.includes('.run.app') ? 'https' : 'http';
  const fullEndpoint = `${protocol}://${host}/api/telemetry`;

  const code = `/*
 * ============================================================================
 * 🌱 SMART CEYLON GREENHOUSE CONTROLLER - ESP32 MAIN FIRMWARE
 * Cultivar: Ceylon Green Chilli (MICH 2 & KA 2) & Greenhouse Crops
 * Sensors: DHT22/SHT31 (Temp/Hum), Capacitive Soil Moisture, LDR/BH1750 (Lux),
 *          RS485 Modbus NPK Soil Sensor (Nitrogen, Phosphorus, Potassium)
 * Actuators: 4-Channel 5V Relay (Vent Fan, Drip Pump, Grow LEDs)
 * Telemetry Cloud Target: ${fullEndpoint}
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // Library: ArduinoJson by Benoit Blanchon (v6.x or v7.x)
#include <DHT.h>         // Library: DHT sensor library by Adafruit

// --------------------------- CONFIGURATION ---------------------------------
const char* WIFI_SSID     = "YOUR_GREENHOUSE_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_GREENHOUSE_WIFI_PASSWORD";

// Hosted Server Telemetry Ingestion URL
const char* SERVER_ENDPOINT = "${fullEndpoint}";

// Pin Assignments
#define DHTPIN            4     // GPIO4 -> DHT22 Data Pin
#define DHTTYPE           DHT22 // DHT 22 (AM2302)
#define SOIL_ANALOG_PIN   34    // GPIO34 (ADC1) -> Capacitive Soil Moisture Sensor (AOUT)
#define LDR_ANALOG_PIN    35    // GPIO35 (ADC1) -> LDR Light Sensor (AOUT)

// Relay Actuator Output Pins (Active LOW for standard 5V Optocoupler Relay Modules)
#define RELAY_FAN_PIN     18    // GPIO18 -> Ventilation Fan Relay
#define RELAY_PUMP_PIN    19    // GPIO19 -> Drip Irrigation Water Pump Relay
#define RELAY_LIGHT_PIN   23    // GPIO23 -> Supplementary Grow Light Relay

// RS485 Modbus NPK Soil Sensor (HardwareSerial 2)
#define RS485_RX_PIN      16    // GPIO16 -> MAX485 RO Pin
#define RS485_TX_PIN      17    // GPIO17 -> MAX485 DI Pin
#define RS485_DE_RE_PIN   5     // GPIO5  -> MAX485 DE & RE Pins (Tied together)

DHT dht(DHTPIN, DHTTYPE);
HardwareSerial modbusSerial(2);

// Modbus Inquiry Frame for 7-in-1 / 3-in-1 Soil NPK Sensor
const byte npkInquiryFrame[] = {0x01, 0x03, 0x00, 0x1E, 0x00, 0x03, 0x65, 0xCD};
byte npkResponseFrame[11];

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n[INIT] Initializing Smart Greenhouse Controller...");

  // Setup Relays
  pinMode(RELAY_FAN_PIN, OUTPUT);
  pinMode(RELAY_PUMP_PIN, OUTPUT);
  pinMode(RELAY_LIGHT_PIN, OUTPUT);
  pinMode(RS485_DE_RE_PIN, OUTPUT);

  // Default Relays OFF (Active LOW relays)
  digitalWrite(RELAY_FAN_PIN, HIGH);
  digitalWrite(RELAY_PUMP_PIN, HIGH);
  digitalWrite(RELAY_LIGHT_PIN, HIGH);
  digitalWrite(RS485_DE_RE_PIN, LOW); // Set RS485 to Receiver Mode

  // Init Sensors
  dht.begin();
  modbusSerial.begin(9600, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 1. Read DHT22 Temperature and Humidity
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[WARN] Failed to read from DHT22 sensor!");
    temperature = 28.5; // Fallback safe reading
    humidity    = 65.0;
  }

  // 2. Read Capacitive Soil Moisture Sensor (Analog 0 - 4095)
  int rawSoil = analogRead(SOIL_ANALOG_PIN);
  // Calibration: ~3200 in dry air (0%), ~1400 in water (100%)
  int soilMoisturePercent = map(rawSoil, 3200, 1400, 0, 100);
  soilMoisturePercent = constrain(soilMoisturePercent, 0, 100);

  // 3. Read LDR Ambient Light (Analog 0 - 4095 -> 0 - 1000 Lux)
  int rawLdr = analogRead(LDR_ANALOG_PIN);
  int lightIntensityLux = map(rawLdr, 0, 4095, 50, 1100);
  lightIntensityLux = constrain(lightIntensityLux, 0, 1200);

  // 4. Read RS485 Soil NPK Macronutrients
  int nitrogen = 160, phosphorus = 45, potassium = 200;
  readNPKSensor(nitrogen, phosphorus, potassium);

  // 5. Build JSON Payload & Send to Hosted Cloud Dashboard
  sendTelemetryToCloud(temperature, humidity, soilMoisturePercent, lightIntensityLux, nitrogen, phosphorus, potassium);

  // Delay between sensor reading cycles (e.g. 5 seconds for real-time monitoring)
  delay(5000);
}

void connectWiFi() {
  Serial.printf("\\n[WIFI] Connecting to %s...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 30) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\\n[WIFI] Connected! Node IP: %s\\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\\n[WIFI] Connection Failed. Will retry in next loop.");
  }
}

void readNPKSensor(int &n, int &p, int &k) {
  // Transmit inquiry frame to RS485 NPK sensor
  digitalWrite(RS485_DE_RE_PIN, HIGH); // Transmitter Mode
  delay(10);
  modbusSerial.write(npkInquiryFrame, sizeof(npkInquiryFrame));
  modbusSerial.flush();
  digitalWrite(RS485_DE_RE_PIN, LOW);  // Receiver Mode
  delay(10);

  // Read response
  byte index = 0;
  unsigned long start = millis();
  while (millis() - start < 1000 && index < 11) {
    if (modbusSerial.available()) {
      npkResponseFrame[index++] = modbusSerial.read();
    }
  }

  if (index >= 11 && npkResponseFrame[0] == 0x01 && npkResponseFrame[1] == 0x03) {
    n = (npkResponseFrame[3] << 8) | npkResponseFrame[4];
    p = (npkResponseFrame[5] << 8) | npkResponseFrame[6];
    k = (npkResponseFrame[7] << 8) | npkResponseFrame[8];
    Serial.printf("[NPK] N: %d mg/kg, P: %d mg/kg, K: %d mg/kg\\n", n, p, k);
  } else {
    // Default safe agricultural NPK baseline for green chilli if RS485 is in transit
    n = 165; p = 48; k = 210;
  }
}

void sendTelemetryToCloud(float temp, float hum, int soil, int light, int n, int p, int k) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(SERVER_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  // Create JSON document
  StaticJsonDocument<512> doc;
  doc["temperature"]    = temp;
  doc["humidity"]       = hum;
  doc["soilMoisture"]   = soil;
  doc["lightIntensity"] = light;
  doc["nitrogen"]       = n;
  doc["phosphorus"]     = p;
  doc["potassium"]      = k;

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.printf("[HTTP] POST %s -> %s\\n", SERVER_ENDPOINT, requestBody.c_str());
  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("[HTTP] Response [%d]: %s\\n", httpResponseCode, response.c_str());

    // Parse commands from server to control physical relays
    StaticJsonDocument<512> resDoc;
    DeserializationError error = deserializeJson(resDoc, response);
    if (!error && resDoc.containsKey("commands")) {
      bool fan   = resDoc["commands"]["fanStatus"];
      bool pump  = resDoc["commands"]["pumpStatus"];
      bool leds  = resDoc["commands"]["lightStatus"];

      // Relays are Active LOW (LOW = Relay ON / Closed Circuit, HIGH = Relay OFF)
      digitalWrite(RELAY_FAN_PIN,   fan  ? LOW : HIGH);
      digitalWrite(RELAY_PUMP_PIN,  pump ? LOW : HIGH);
      digitalWrite(RELAY_LIGHT_PIN, leds ? LOW : HIGH);

      Serial.printf("[ACTUATORS] Relay State -> Fan: %s | Pump: %s | Grow LEDs: %s\\n", 
                    fan ? "ON" : "OFF", pump ? "ON" : "OFF", leds ? "ON" : "OFF");
    }
  } else {
    Serial.printf("[HTTP] Error sending telemetry: %s\\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}
`;

  res.setHeader('Content-Type', 'text/plain');
  res.send(code);
});

// GET Ready-to-Flash C++ Code for ESP32-CAM Arduino IDE
app.get('/api/esp32cam/code', (req, res) => {
  const host = req.get('host') || 'ais-pre-ztuwzwjna4dm2b5dui3z7k-717668214907.asia-southeast1.run.app';
  const protocol = req.protocol === 'https' || host.includes('.run.app') ? 'https' : 'http';
  const serverUploadUrl = `${protocol}://${host}/api/esp32cam/upload`;

  const code = `#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Smart Greenhouse Server Dual-CAM Intake Endpoint URL
const char* serverUrl = "${serverUploadUrl}";

// AI Thinker ESP32-CAM Pin Mapping
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setup() {
  Serial.begin(115200);
  
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_siod = SIOD_GPIO_NUM;
  config.pin_sioc = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  if(psramFound()){
    config.frame_size = FRAMESIZE_UXGA; // 1600x1200
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  // WiFi init
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  captureAndSendFrame();
  delay(30000); // Send photo frame every 30 seconds
}

void captureAndSendFrame() {
  camera_fb_t * fb = esp_camera_fb_get();
  if(!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  if(WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "image/jpeg");
    
    int httpResponseCode = http.POST(fb->buf, fb->len);
    if(httpResponseCode > 0) {
      Serial.printf("Frame sent successfully! Server HTTP Response: %d\\n", httpResponseCode);
    } else {
      Serial.printf("Error sending frame: %s\\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }
  esp_camera_fb_return(fb);
}`;
  res.setHeader('Content-Type', 'text/plain');
  res.send(code);
});

// 🤖 AI Interactive Smart Greenhouse Chatbot Route
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, sensorData, controlData, thresholds } = req.body;

    const activeThresholds = thresholds || {
      tempHigh: 32,
      tempLow: 26,
      soilLow: 40,
      soilHigh: 70,
      lightLow: 300,
      lightHigh: 800,
    };

    // Fallback Mock response if API key is not present
    if (!apiKey) {
      console.log('Using simulated offline chatbot response...');
      const lower = message.toLowerCase();
      let reply = "I am running in offline demo mode, but I can still support you! ";
      let commands: Record<string, any> = {};

      if (lower.includes('fan on') || lower.includes('start fan')) {
        reply += "I have processed your command and initialized the cooling fan actuator nodes.";
        commands.fan = true;
      } else if (lower.includes('fan off') || lower.includes('stop fan')) {
        reply += "I have shut down the ventilation fans.";
        commands.fan = false;
      } else if (lower.includes('water') || lower.includes('pump') || lower.includes('irrigate')) {
        reply += "I triggered the micro-drip water pump to irrigate the chilli beds.";
        commands.pump = true;
      } else if (lower.includes('temp') && (lower.includes('threshold') || lower.includes('set') || lower.includes('change'))) {
        // Extract number from string if available
        const numMatch = lower.match(/\d+(\.\d+)?/);
        const val = numMatch ? parseFloat(numMatch[0]) : 34;
        if (lower.includes('low')) {
          commands.tempLow = val;
          reply += `I have updated the Low Temperature Threshold to ${val}°C.`;
        } else {
          commands.tempHigh = val;
          reply += `I have updated the High Temperature Threshold to ${val}°C.`;
        }
      } else if (lower.includes('soil') && (lower.includes('threshold') || lower.includes('set') || lower.includes('change'))) {
        const numMatch = lower.match(/\d+(\.\d+)?/);
        const val = numMatch ? parseFloat(numMatch[0]) : 35;
        if (lower.includes('high')) {
          commands.soilHigh = val;
          reply += `I have updated the High Soil Moisture Threshold to ${val}%.`;
        } else {
          commands.soilLow = val;
          reply += `I have updated the Low Soil Moisture Threshold to ${val}%.`;
        }
      } else if (lower.includes('light') && (lower.includes('threshold') || lower.includes('set') || lower.includes('change'))) {
        const numMatch = lower.match(/\d+/);
        const val = numMatch ? parseInt(numMatch[0], 10) : 400;
        if (lower.includes('high')) {
          commands.lightHigh = val;
          reply += `I have updated the High Light Threshold to ${val} lx.`;
        } else {
          commands.lightLow = val;
          reply += `I have updated the Low Light Threshold to ${val} lx.`;
        }
      } else if (lower.includes('threshold')) {
        reply += `Current Automation Thresholds:\n• Temp High: ${activeThresholds.tempHigh}°C | Low: ${activeThresholds.tempLow}°C\n• Soil Low: ${activeThresholds.soilLow}% | High: ${activeThresholds.soilHigh}%\n• Light Low: ${activeThresholds.lightLow} lx | High: ${activeThresholds.lightHigh} lx.\nYou can ask me to change any of these!`;
      } else if (lower.includes('status') || lower.includes('sensor')) {
        reply += `Current microclimate readings: Temp: ${sensorData.temperature}°C, Soil moisture: ${sensorData.soilMoisture}%, Light: ${sensorData.lightIntensity} lx. Everything looks fully functional!`;
      } else {
        reply += "Ayubowan! The Ceylon Green Chilli varieties MICH 2 and KA 2 require stable ambient temperature (25–32°C) and consistent sub-drip cycles to ensure high pungency yields. You can ask me to change automation thresholds, check sensors, or toggle devices!";
      }

      return res.json({ reply, commands });
    }

    // Call real Gemini model
    const systemInstruction = `You are an expert Smart Greenhouse Assistant named "Greenhouse Assistant" specializing in automated Green Chilli cultivation (specifically MICH 2 and KA 2 Ceylon cultivars) in Sri Lanka.
Your job is to answer questions, explain sensor telemetry (live AND historical), diagnose plant health issues, help control actuators, and adjust microclimate automation thresholds.

LANGUAGE RULES (follow exactly):
- Decide the reply language from the user's MOST RECENT message only.
- If it is written in English, reply only in English.
- If it is written in Sinhala Unicode script (සිංහල අකුරු), reply only in Sinhala Unicode script.
- If it is written in "Singlish" — Sinhala words spelled out phonetically with English letters (e.g. "wathura demmada", "fan eka on karanna", "temperature eka kiyanna") — you MUST reply only in proper Sinhala Unicode script (සිංහල අකුරු). Never reply in Singlish, and never reply in English to a Sinhala/Singlish message.
- Never mix scripts within one reply.

LIVE SENSOR READINGS (right now only):
- Air Temperature: ${sensorData.temperature}°C (Ideal: 25-32°C)
- Air Humidity: ${sensorData.humidity}% (Ideal: 55-75%)
- Soil Moisture Index: ${sensorData.soilMoisture}% (Ideal: 40-70%)
- LDR Ambient Light: ${sensorData.lightIntensity} lx (Ideal: 300-1000 lx)
- NPK: N ${sensorData.nitrogen ?? 0} / P ${sensorData.phosphorus ?? 0} / K ${sensorData.potassium ?? 0} mg/kg
- Crop Stage: ${sensorData.growthStage}
- Health Score: ${sensorData.healthScore}%

HISTORICAL DATA RULE (very important):
- The readings above are LIVE ONLY. For anything about a past date, a specific date, "today's average", "yesterday", "this week", or any range — you MUST call the get_sensor_history function to get REAL logged data. Never invent or estimate a historical number.
- If the tool result has hasData:false, tell the user honestly that no readings were logged for that period (e.g. hardware wasn't connected) — do not make one up.
- If hasData:true, quote its exact numbers (they are averages over sampleCount real logged readings).
- "Today" means the current date; if the user doesn't give a year, assume the current year.

CURRENT ACTUATOR STATUS:
- Ventilation Fan: ${controlData.fanStatus ? 'ON' : 'OFF'}
- Water Pump: ${controlData.pumpStatus ? 'ON (Irrigating)' : 'OFF (Idle)'}
- Grow LEDs: ${controlData.lightStatus ? 'ON' : 'OFF'}
- Greenhouse care mode: ${controlData.autoMode ? 'AUTOMATED CARE' : 'MANUAL OVERRIDE'}

CURRENT AUTOMATION THRESHOLDS:
- High Temperature Threshold (Fan ON): ${activeThresholds.tempHigh}°C
- Low Temperature Threshold (Fan OFF): ${activeThresholds.tempLow}°C
- Low Soil Moisture Threshold (Pump ON): ${activeThresholds.soilLow}%
- High Soil Moisture Threshold (Pump OFF): ${activeThresholds.soilHigh}%
- Low Light Threshold (LED ON): ${activeThresholds.lightLow} lx
- High Light Threshold (LED OFF): ${activeThresholds.lightHigh} lx

PLANT DISEASE ADVICE:
- When the user describes symptoms (leaf spots, curling, yellowing, wilting, mold, pests, stunted growth, etc.) or asks for a diagnosis in chat, give real, specific agronomic guidance for Ceylon green chilli using genuine plant pathology knowledge — name the likely condition(s) (e.g. Chilli Leaf Curl Virus, Anthracnose/Colletotrichum, powdery mildew, aphid/whitefly infestation, a specific nutrient deficiency), which symptoms match, and concrete treatment and prevention steps.
- A text description is inherently less reliable than a photo. If it sounds like the user could take a picture, mention that the app's "Live AI Disease Detection" camera page runs a real photo-based Gemini Vision diagnosis, which is more reliable than describing it in words.

INSTRUCTIONS FOR COMMANDS:
1. Actuators: If the user commands you to turn on/off the fan, pump, or LED lights, set "fan", "pump", or "led" true/false in commands.
2. Thresholds: If the user commands you to change or set any threshold value (e.g., "Set temperature high threshold to 34", "Set temp low to 24", "Set soil low threshold to 35%", "Set light high to 900", or in Sinhala/Singlish equivalents):
   - Clearly state the updated value in your "reply" (in the correct language per the LANGUAGE RULES above).
   - Set the corresponding numerical command property in "commands":
     - tempHigh (number)
     - tempLow (number)
     - soilLow (number)
     - soilHigh (number)
     - lightLow (number)
     - lightHigh (number)`;

    // Build the multi-turn conversation from prior history + the new message.
    const priorTurns = (Array.isArray(history) ? history : []).slice(-8).map((h: any) => ({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: String(h.text || '') }],
    }));
    const baseContents = [...priorTurns, { role: 'user', parts: [{ text: message }] }];

    // Phase 1: let Gemini decide whether it needs real historical data. This
    // call is tool-enabled but NOT forced into JSON mode, since a model
    // can't reliably emit a function call and a schema-constrained object
    // in the same turn.
    let toolResultNote = '';
    try {
      const toolPhase = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: baseContents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [getSensorHistoryDeclaration] }],
        },
      });

      const calls = toolPhase.functionCalls;
      const historyCall = calls?.find((c) => c.name === 'get_sensor_history');
      if (historyCall) {
        const args = (historyCall.args || {}) as { startDate?: string; endDate?: string };
        const startDate = args.startDate || new Date().toISOString().split('T')[0];
        const endDate = args.endDate || startDate;
        const result = await runGetSensorHistory(startDate, endDate);
        toolResultNote = `\n\n(System note, not from the user — REAL sensor history lookup result for ${startDate} to ${endDate}, from actual logged hardware data. Use these exact numbers if you reference this period, and be honest if hasData is false: ${JSON.stringify(result)})`;
      }
    } catch (toolErr: any) {
      console.warn('Sensor history tool-call phase failed, continuing without it:', toolErr?.message || toolErr);
    }

    // Phase 2: final structured reply (+ any device/threshold commands),
    // now with the real historical data (if any) available as context.
    const finalContents = toolResultNote
      ? [...baseContents, { role: 'user', parts: [{ text: toolResultNote }] }]
      : baseContents;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: finalContents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: 'Your conversational explanation or command verification, in English or Sinhala Unicode per the LANGUAGE RULES.' },
            commands: {
              type: Type.OBJECT,
              properties: {
                fan: { type: Type.BOOLEAN, description: 'Set true to turn fan ON, false to turn OFF.' },
                pump: { type: Type.BOOLEAN, description: 'Set true to turn water pump ON, false to turn OFF.' },
                led: { type: Type.BOOLEAN, description: 'Set true to turn grow lights ON, false to turn OFF.' },
                tempHigh: { type: Type.NUMBER, description: 'New High Temperature threshold value in °C' },
                tempLow: { type: Type.NUMBER, description: 'New Low Temperature threshold value in °C' },
                soilLow: { type: Type.NUMBER, description: 'New Low Soil Moisture threshold value in %' },
                soilHigh: { type: Type.NUMBER, description: 'New High Soil Moisture threshold value in %' },
                lightLow: { type: Type.NUMBER, description: 'New Low Ambient Light threshold value in lx' },
                lightHigh: { type: Type.NUMBER, description: 'New High Ambient Light threshold value in lx' },
              }
            }
          },
          required: ['reply'],
        }
      }
    });

    const parsedResponse = JSON.parse(response.text || '{}');
    return res.json(parsedResponse);

  } catch (err: any) {
    console.error('Error in chatbot API:', err);
    return res.status(500).json({ error: 'AI dialogue failed.', details: err.message });
  }
});

export default app;
