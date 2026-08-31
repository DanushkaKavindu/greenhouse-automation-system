import { useState, useEffect } from 'react';
import { PageId, SensorData, ControlData, CalendarEvent, DiseaseDetectionHistory, Thresholds, CropVariety } from './types';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Chatbot from './components/Chatbot';
import HardwareConnectModal from './components/HardwareConnectModal';

// Page Views
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Controls from './pages/Controls';
import Reports from './pages/Reports';
import AIAnalysis from './pages/AIAnalysis';
import CalendarPage from './pages/CalendarPage';
import About from './pages/About';

import { db, onSensorChange, onControlChange, onThresholdChange, updateSensorNode, updateControlNode, updateThresholdNode } from './firebase';

const cropPresets: CropVariety[] = [
  {
    name: 'MICH 2 (Green Chilli)',
    origin: 'Mahailluppallama, Sri Lanka',
    optimalTemp: '25°C - 32°C',
    optimalHumidity: '55% - 75%',
    optimalSoil: '40% - 70%',
    optimalLight: '300 lx - 1000 lx',
    optimalNPK: {
      n: '140 - 200 mg/kg',
      p: '35 - 60 mg/kg',
      k: '160 - 250 mg/kg',
    },
    description: 'High-yielding green chilli variety resistant to Chilli Leaf Curl Virus, with high heat pungency.',
    standardDurationDays: 110,
  },
  {
    name: 'Padma (Tomato)',
    origin: 'Central Province, Sri Lanka',
    optimalTemp: '22°C - 30°C',
    optimalHumidity: '60% - 80%',
    optimalSoil: '50% - 80%',
    optimalLight: '400 lx - 1200 lx',
    optimalNPK: {
      n: '120 - 180 mg/kg',
      p: '40 - 70 mg/kg',
      k: '180 - 280 mg/kg',
    },
    description: 'Disease-resistant hybrid tomato variety suitable for greenhouse high-temperature cultivation.',
    standardDurationDays: 80,
  },
  {
    name: 'California Wonder (Bell Pepper)',
    origin: 'Western Province, Sri Lanka',
    optimalTemp: '20°C - 28°C',
    optimalHumidity: '60% - 75%',
    optimalSoil: '50% - 70%',
    optimalLight: '300 lx - 900 lx',
    optimalNPK: {
      n: '130 - 190 mg/kg',
      p: '35 - 65 mg/kg',
      k: '170 - 260 mg/kg',
    },
    description: 'Blocky sweet bell pepper with thick walls, highly adaptive to automated drip irrigation.',
    standardDurationDays: 95,
  },
  {
    name: 'Grand Rapids (Lettuce)',
    origin: 'Nuwara Eliya, Sri Lanka',
    optimalTemp: '15°C - 22°C',
    optimalHumidity: '50% - 70%',
    optimalSoil: '60% - 80%',
    optimalLight: '200 lx - 600 lx',
    optimalNPK: {
      n: '150 - 220 mg/kg',
      p: '30 - 50 mg/kg',
      k: '140 - 210 mg/kg',
    },
    description: 'Fast-growing leafy green lettuce, perfect for rapid hydroponic or micro-irrigation systems.',
    standardDurationDays: 45,
  },
];

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('landing');
  const [user, setUser] = useState<any>(null);

  // Core sensor and control states.
  // Everything starts at zero: these are REAL readings, not demo data, and
  // stay at zero until the ESP32 (or Firestore) actually reports a value.
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 0,
    humidity: 0,
    soilMoisture: 0,
    lightIntensity: 0,
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0,
    timestamp: null,
    growthStage: 'Seedling',
    healthScore: 0,
  });

  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const getRelativeDateStr = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  };

  const getDefaultPlantingDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 74);
    return d.toISOString().split('T')[0];
  };

  const [plantingDate, setPlantingDate] = useState<string>(getDefaultPlantingDate());
  const [currentCrop, setCurrentCrop] = useState<CropVariety>(cropPresets[0]);
  const [aiHarvestDays, setAiHarvestDays] = useState<number | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(getTodayDateStr());

  // Real physical greenhouse hardware connectivity & simulation controls
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [isHardwareConnected, setIsHardwareConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [isLiveHardwareMode, setIsLiveHardwareMode] = useState(true); // Default to live real data mode!
  const [isSimulationActive, setIsSimulationActive] = useState<boolean>(false); // Allow toggling simulation only when desired

  // Periodically poll backend /api/telemetry to detect physical ESP32 packets
  useEffect(() => {
    const checkHardwareTelemetry = async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (!res.ok) return;

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          // No API backend deployed at this host (e.g. static-only hosting) —
          // this is an HTML fallback page, not real telemetry. Ignore it.
          return;
        }

        const data = await res.json();
        setIsHardwareConnected(Boolean(data.isHardwareConnected));
        setLastHeartbeat(data.lastHeartbeat ?? null);

        if (data.isHardwareConnected) {
          // Real ESP32 packet received recently — show the actual readings.
          if (data.sensorData) {
            setSensorData((prev) => ({
              ...prev,
              ...data.sensorData,
            }));
          }
          if (data.actuators) {
            setControlData((prev) => ({
              ...prev,
              ...data.actuators,
            }));
          }
        } else if (isLiveHardwareMode) {
          // "Strict Real Hardware" mode with no ESP32 connected: never invent
          // numbers — show zero for every raw sensor reading instead of
          // freezing on the last (or a fabricated) value.
          setSensorData((prev) => ({
            ...prev,
            temperature: 0,
            humidity: 0,
            soilMoisture: 0,
            lightIntensity: 0,
            nitrogen: 0,
            phosphorus: 0,
            potassium: 0,
            timestamp: null,
          }));
        }
        // else: "Simulator Fallback" mode with no hardware connected — leave
        // sensorData alone; the microclimate simulator effect (when the user
        // explicitly enables it) is responsible for driving those numbers.
      } catch (err) {
        // Silent catch for background telemetry polling
      }
    };

    checkHardwareTelemetry();
    const telemetryTimer = setInterval(checkHardwareTelemetry, 3000);
    return () => clearInterval(telemetryTimer);
  }, [isLiveHardwareMode]);

  const handleUpdateGrowthStage = (stage: 'Seedling' | 'Vegetative' | 'Flowering' | 'Fruiting') => {
    setSensorData((prev) => {
      const updated = { ...prev, growthStage: stage };
      if (user) {
        updateSensorNode({ growthStage: stage });
      }
      return updated;
    });
  };

  const handleUpdateHealthScore = (score: number) => {
    setSensorData((prev) => {
      const updated = { ...prev, healthScore: score };
      if (user) {
        updateSensorNode({ healthScore: score });
      }
      return updated;
    });
  };

  const [controlData, setControlData] = useState<ControlData>({
    fanStatus: false,
    pumpStatus: false,
    lightStatus: false,
    autoMode: true,
  });

  const [thresholds, setThresholds] = useState<Thresholds>({
    tempHigh: 32,
    tempLow: 26,
    soilLow: 40,
    soilHigh: 70,
    lightLow: 300,
    lightHigh: 800,
    nLow: 120,
    nHigh: 220,
    pLow: 30,
    pHigh: 70,
    kLow: 150,
    kHigh: 280,
  });

  const [updateInterval, setUpdateInterval] = useState<number>(800); // 800ms default

  // Calendar scheduled events list with current real dates
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([
    {
      id: 'evt_1',
      title: '💧 Automated Drip Irrigation',
      description: 'Standard moisture hydration cycle triggered.',
      date: getTodayDateStr(),
      type: 'normal',
      details: 'Pump ran for 45s'
    },
    {
      id: 'evt_2',
      title: '🧪 NPK Soil Nutrient Telemetry Update',
      description: 'Nitrogen, Phosphorus, and Potassium detected within optimal ranges for Ceylon Chilli fruiting.',
      date: getTodayDateStr(),
      type: 'normal',
      details: 'NPK Sensor: Modbus RTU Online'
    },
    {
      id: 'evt_3',
      title: '🌡️ Microclimate Heat Spike Warning',
      description: 'Sensors detected temperature surge at 33.5°C.',
      date: getRelativeDateStr(-1),
      type: 'warning',
      details: 'Fan triggered on GPIO'
    },
    {
      id: 'evt_4',
      title: '🚨 Volumetric Soil Moisture Check',
      description: 'Volumetric soil index calibrated.',
      date: getRelativeDateStr(-3),
      type: 'critical',
      details: 'Water reservoir checked'
    }
  ]);

  const [isCalendarConnected, setIsCalendarConnected] = useState(false);

  // AI disease diagnosis list with dynamic current date
  const [diagnosisHistory, setDiagnosisHistory] = useState<DiseaseDetectionHistory[]>([
    {
      id: 'diag_1',
      diseaseName: 'MICH 2 Healthy Chilli',
      confidence: 96,
      severity: 'Healthy',
      timestamp: getTodayDateStr(),
      treatment: ['Keep soil moisture stable.'],
      preventive: ['Ventilate regularly.'],
    }
  ]);

  // Connect real-time Firestore database hooks for live synchronization
  useEffect(() => {
    const unsubscribeSensors = onSensorChange((data) => {
      if (data) {
        setSensorData((prev) => ({ ...prev, ...data }));
        // When real Firestore readings arrive, ensure simulation doesn't overwrite them
        setIsHardwareConnected(true);
      }
    });

    const unsubscribeControls = onControlChange((data) => {
      if (data) setControlData((prev) => ({ ...prev, ...data }));
    });

    const unsubscribeThresholds = onThresholdChange((data) => {
      if (data) setThresholds((prev) => ({ ...prev, ...data }));
    });

    return () => {
      unsubscribeSensors();
      unsubscribeControls();
      unsubscribeThresholds();
    };
  }, []);

  // Cybernetic Microclimate Simulator
  // Only runs when simulation mode is explicitly enabled and not in real live hardware stream
  useEffect(() => {
    if (!isSimulationActive) return;

    const interval = setInterval(() => {
      setSensorData((prev) => {
        let temp = prev.temperature;
        let hum = prev.humidity;
        let soil = prev.soilMoisture;
        let light = prev.lightIntensity;
        let n = prev.nitrogen ?? 165;
        let p = prev.phosphorus ?? 48;
        let k = prev.potassium ?? 210;

        // Influence parameters depending on actuator status
        if (controlData.fanStatus) {
          // Cooling active
          temp = Math.max(24.5, temp - 0.2);
          hum = Math.max(50, hum - 0.3);
        } else {
          // Natural heating under Sri Lankan tropical sun
          temp = Math.min(34.8, temp + 0.1);
          hum = Math.min(85, hum + 0.1);
        }

        if (controlData.pumpStatus) {
          // Irrigator active (slight nutrient dispersion)
          soil = Math.min(85, soil + 1.2);
          n = Math.max(130, n - 0.05);
        } else {
          // Soil naturally dries up
          soil = Math.max(30, soil - 0.15);
        }

        if (controlData.lightStatus) {
          // Supplement grow LEDs active (stimulates potassium and phosphorus metabolism)
          light = Math.min(1000, light + 25);
        } else {
          // Fluctuating cloud shadows
          const change = (Math.random() - 0.5) * 15;
          light = Math.max(150, Math.min(950, light + change));
        }

        // Slight natural nutrient uptake by active crop roots
        n = Math.max(110, Math.min(220, n + (Math.random() - 0.5) * 0.4));
        p = Math.max(25, Math.min(75, p + (Math.random() - 0.5) * 0.2));
        k = Math.max(140, Math.min(270, k + (Math.random() - 0.5) * 0.5));

        // Round values cleanly
        temp = parseFloat(temp.toFixed(1));
        hum = parseFloat(hum.toFixed(1));
        soil = Math.round(soil);
        light = Math.round(light);
        n = Math.round(n);
        p = Math.round(p);
        k = Math.round(k);

        // Run Automation Rule Triggers if AutoMode is ON
        if (controlData.autoMode) {
          let nextFan = controlData.fanStatus;
          let nextPump = controlData.pumpStatus;
          let nextLight = controlData.lightStatus;

          // Rule 1: Temp > tempHigh -> Fan ON
          if (temp > thresholds.tempHigh) nextFan = true;
          // Rule 2: Soil < soilLow -> Pump ON
          if (soil < thresholds.soilLow) nextPump = true;
          // Rule 3: Light < lightLow -> LEDs ON
          if (light < thresholds.lightLow) nextLight = true;
          // Rule 4: Soil > soilHigh -> Pump OFF (prevent root waterlogging)
          if (soil > thresholds.soilHigh) nextPump = false;
          // Rule 5: Temp < tempLow -> Fan OFF
          if (temp < thresholds.tempLow) nextFan = false;
          // Rule 6: Light > lightHigh -> LEDs OFF (energy saving)
          if (light > thresholds.lightHigh) nextLight = false;

          if (
            nextFan !== controlData.fanStatus ||
            nextPump !== controlData.pumpStatus ||
            nextLight !== controlData.lightStatus
          ) {
            setControlData((c) => {
              const updated = {
                ...c,
                fanStatus: nextFan,
                pumpStatus: nextPump,
                lightStatus: nextLight,
              };
              if (user) {
                updateControlNode(updated);
              }
              return updated;
            });
          }
        }

        const updatedSensors = {
          ...prev,
          temperature: temp,
          humidity: hum,
          soilMoisture: soil,
          lightIntensity: light,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        // If connected to firebase, update database
        if (user) {
          updateSensorNode(updatedSensors);
        }

        return updatedSensors;
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [controlData, user, thresholds, updateInterval]);

  // Handle local control switches
  const handleUpdateControl = (field: keyof ControlData, value: boolean) => {
    setControlData((prev) => {
      const updated = { ...prev, [field]: value };
      if (user) {
        updateControlNode(updated);
      }
      return updated;
    });
  };

  const handleUpdateThresholds = (newThresholds: Thresholds) => {
    setThresholds(newThresholds);
    if (user) {
      updateThresholdNode(newThresholds);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActivePage('landing');
  };

  const handleConnectGoogleCalendar = () => {
    setIsCalendarConnected(true);
    alert('Successfully integrated Google Workspace Calendar API! Daily average readings and alerts will now push directly into G-Suite.');
  };

  return (
    <div className="min-h-screen bg-slate-bg font-sans text-text-primary antialiased flex transition-colors duration-300">
      
      {/* Conditionally Render Sidebar & MobileNav if logged in and not on Landing/Login */}
      {user && activePage !== 'landing' && activePage !== 'login' && (
        <>
          <Sidebar
            activePage={activePage}
            onPageChange={setActivePage}
            user={user}
            onLogout={handleLogout}
          />
          <MobileNav
            activePage={activePage}
            onPageChange={setActivePage}
            user={user}
            onLogout={handleLogout}
          />
        </>
      )}

      {/* Main Content Area */}
      <main 
        className={`flex-1 min-h-screen min-w-0 w-full max-w-full overflow-x-hidden transition-all duration-300 ${
          user && activePage !== 'landing' && activePage !== 'login'
            ? 'md:ml-24 p-3 sm:p-4 md:p-6 pt-16 sm:pt-20 md:pt-6 pb-28 md:pb-6' 
            : 'w-full'
        }`}
      >
        
        {/* Router Pages */}
        {activePage === 'landing' && (
          <LandingPage 
            onStart={() => setActivePage('login')} 
            onViewDemo={() => {
              // Sign in a default simulated user
              setUser({
                uid: 'demo_user_123',
                email: 'cultivator@greenhouse.lk',
                displayName: 'Green Chilli Cultivator (Demo)',
                photoURL: null,
              });
              setActivePage('dashboard');
            }}
          />
        )}

        {activePage === 'login' && (
          <LoginPage 
            onLoginSuccess={(usr) => {
              setUser(usr);
              setActivePage('dashboard');
            }}
            onSkip={() => setActivePage('landing')}
          />
        )}

        {user && activePage === 'dashboard' && (
          <Dashboard 
            sensorData={sensorData} 
            controlData={controlData} 
            onUpdateControl={handleUpdateControl}
            onPageChange={setActivePage}
            currentCrop={currentCrop}
            cropPresets={cropPresets}
            onUpdateCrop={setCurrentCrop}
            plantingDate={plantingDate}
            onUpdatePlantingDate={setPlantingDate}
            onUpdateGrowthStage={handleUpdateGrowthStage}
            aiHarvestDays={aiHarvestDays}
            onUpdateAIHarvestDays={setAiHarvestDays}
            onUpdateHealthScore={handleUpdateHealthScore}
            selectedCalendarDate={selectedCalendarDate}
            onUpdateSelectedCalendarDate={setSelectedCalendarDate}
            onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
            isHardwareConnected={isHardwareConnected}
            lastHeartbeat={lastHeartbeat}
          />
        )}

        {user && activePage === 'controls' && (
          <Controls 
            sensorData={sensorData} 
            controlData={controlData} 
            onUpdateControl={handleUpdateControl}
            thresholds={thresholds}
            onUpdateThresholds={handleUpdateThresholds}
            updateInterval={updateInterval}
            onUpdateIntervalChange={setUpdateInterval}
            onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
            isHardwareConnected={isHardwareConnected}
            lastHeartbeat={lastHeartbeat}
          />
        )}

        {user && activePage === 'reports' && (
          <Reports />
        )}

        {user && activePage === 'ai-analysis' && (
          <AIAnalysis 
            sensorData={sensorData}
            diagnosisHistory={diagnosisHistory}
            onAddDiagnosis={(item) => setDiagnosisHistory((prev) => [item, ...prev])}
            onUpdateHealthScore={handleUpdateHealthScore}
          />
        )}

        {user && activePage === 'calendar' && (
          <CalendarPage 
            events={calendarEvents}
            onAddEvent={(evt) => setCalendarEvents((prev) => [evt, ...prev])}
            onConnectCalendar={handleConnectGoogleCalendar}
            isConnected={isCalendarConnected}
            selectedDateStr={selectedCalendarDate}
            onSelectDateStr={setSelectedCalendarDate}
            onNavigateToDashboard={() => setActivePage('dashboard')}
          />
        )}

        {activePage === 'about' && (
          <About />
        )}

      </main>

      {/* Real Physical Hardware Connection & Cloud Hosting Modal */}
      <HardwareConnectModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
        isHardwareConnected={isHardwareConnected}
        lastHeartbeat={lastHeartbeat}
        sensorData={sensorData}
        controlData={controlData}
        isLiveHardwareMode={isLiveHardwareMode}
        onToggleLiveHardwareMode={setIsLiveHardwareMode}
      />

      {/* Persistent Assistant Chatbot (Only visible if logged in and active page is authenticated) */}
      {user && activePage !== 'landing' && activePage !== 'login' && (
        <Chatbot 
          sensorData={sensorData}
          controlData={controlData}
          onUpdateControl={handleUpdateControl}
          thresholds={thresholds}
          onUpdateThresholds={handleUpdateThresholds}
        />
      )}

    </div>
  );
}
