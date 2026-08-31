export interface SensorData {
  temperature: number; // °C
  humidity: number;    // %
  soilMoisture: number; // %
  lightIntensity: number; // lx
  nitrogen: number;    // mg/kg (ppm)
  phosphorus: number;  // mg/kg (ppm)
  potassium: number;   // mg/kg (ppm)
  timestamp: any;
  growthStage: 'Seedling' | 'Vegetative' | 'Flowering' | 'Fruiting';
  healthScore: number; // 0 to 100
}

export interface ControlData {
  fanStatus: boolean;
  pumpStatus: boolean;
  lightStatus: boolean; // LED
  nutrientDoserStatus?: boolean; // NPK Fertigation Doser
  autoMode: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
  createdAt: any;
}

export interface DiseaseDetectionHistory {
  id: string;
  diseaseName: string;
  confidence: number;
  severity: 'Healthy' | 'Warning' | 'Critical';
  timestamp: any;
  treatment: string[];
  preventive: string[];
  imageUrl?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  sinhala?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  type: 'normal' | 'warning' | 'critical';
  details?: string;
}

export type PageId = 'landing' | 'dashboard' | 'controls' | 'reports' | 'ai-analysis' | 'calendar' | 'about' | 'login' | 'register';

export interface Thresholds {
  tempHigh: number; // to turn Fan ON (e.g. 32°C)
  tempLow: number;  // to turn Fan OFF (e.g. 26°C)
  soilLow: number;  // to turn Pump ON (e.g. 40%)
  soilHigh: number; // to turn Pump OFF (e.g. 70%)
  lightLow: number; // to turn LEDs ON (e.g. 300 lx)
  lightHigh: number;// to turn LEDs OFF (e.g. 800 lx)
  nitrogenLow?: number;    // Nitrogen minimum (e.g. 130 mg/kg)
  nitrogenHigh?: number;   // Nitrogen maximum (e.g. 210 mg/kg)
  phosphorusLow?: number;  // Phosphorus minimum (e.g. 30 mg/kg)
  phosphorusHigh?: number; // Phosphorus maximum (e.g. 65 mg/kg)
  potassiumLow?: number;   // Potassium minimum (e.g. 150 mg/kg)
  potassiumHigh?: number;  // Potassium maximum (e.g. 260 mg/kg)
  nLow?: number;    // Alias for Nitrogen minimum
  nHigh?: number;   // Alias for Nitrogen maximum
  pLow?: number;    // Alias for Phosphorus minimum
  pHigh?: number;   // Alias for Phosphorus maximum
  kLow?: number;    // Alias for Potassium minimum
  kHigh?: number;   // Alias for Potassium maximum
}

export interface ESP32CamFrame {
  id: string;
  imageUrl: string;
  timestamp: string;
  isoTime: string;
  source: 'esp32_cam' | 'simulated' | 'webcam';
  ipAddress: string;
  rssi: number;
  resolution: string;
  fps: number;
  disease: {
    diseaseName: string;
    confidence: number;
    severity: 'Healthy' | 'Warning' | 'Critical';
    symptoms: string[];
    treatment: string[];
    preventive: string[];
  };
  growth: {
    plantHeightCm: number;
    heightGrowthRate: number; // cm/day
    stemDiameterMm: number;
    leafCount: number;
    growthStage: 'Seedling' | 'Vegetative' | 'Flowering' | 'Fruiting';
    healthScore: number;
    estDaysToHarvest: number;
    observations: string;
  };
}

export interface CropVariety {
  name: string;
  origin: string;
  optimalTemp: string;
  optimalHumidity: string;
  optimalSoil: string;
  optimalLight: string;
  optimalNPK: {
    n: string; // e.g. "140 - 200 mg/kg"
    p: string; // e.g. "35 - 60 mg/kg"
    k: string; // e.g. "160 - 250 mg/kg"
  };
  description: string;
  standardDurationDays: number;
}


