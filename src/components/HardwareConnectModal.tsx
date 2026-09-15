import React, { useState, useEffect } from 'react';
import { Wifi, Cpu, Copy, Check, ExternalLink, Globe, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, X, Zap, Server, Terminal, Radio, Eye } from 'lucide-react';
import { SensorData, ControlData } from '../types';

interface HardwareConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHardwareConnected: boolean;
  lastHeartbeat: string | null;
  sensorData: SensorData;
  controlData: ControlData;
  isLiveHardwareMode: boolean;
  onToggleLiveHardwareMode: (enabled: boolean) => void;
}

export default function HardwareConnectModal({
  isOpen,
  onClose,
  isHardwareConnected,
  lastHeartbeat,
  sensorData,
  controlData,
  isLiveHardwareMode,
  onToggleLiveHardwareMode,
}: HardwareConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'firmware-esp32' | 'firmware-cam' | 'hosting-guide' | 'wiring'>('status');
  const [esp32Code, setEsp32Code] = useState<string>('');
  const [esp32CamCode, setEsp32CamCode] = useState<string>('');
  const [copiedEsp32, setCopiedEsp32] = useState(false);
  const [copiedCam, setCopiedCam] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  // Derive active hosted website URL
  const currentHost = typeof window !== 'undefined' ? window.location.host : 'ais-pre-ztuwzwjna4dm2b5dui3z7k-717668214907.asia-southeast1.run.app';
  const currentProtocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const hostedBaseUrl = `${currentProtocol}//${currentHost}`;
  const telemetryEndpoint = `${hostedBaseUrl}/api/telemetry`;
  const camEndpoint = `${hostedBaseUrl}/api/esp32cam/upload`;

  useEffect(() => {
    if (isOpen) {
      setIsLoadingCode(true);
      // Fetch dynamic C++ firmware code with injected host URL
      Promise.all([
        fetch('/api/firmware/esp32').then(r => r.text()).catch(() => '// Error loading ESP32 code'),
        fetch('/api/esp32cam/code').then(r => r.text()).catch(() => '// Error loading ESP32-CAM code'),
      ]).then(([code1, code2]) => {
        setEsp32Code(code1);
        setEsp32CamCode(code2);
        setIsLoadingCode(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: 'esp32' | 'cam' | 'url') => {
    navigator.clipboard.writeText(text);
    if (type === 'esp32') {
      setCopiedEsp32(true);
      setTimeout(() => setCopiedEsp32(false), 2000);
    } else if (type === 'cam') {
      setCopiedCam(true);
      setTimeout(() => setCopiedCam(false), 2000);
    } else if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div 
        className="bg-card-bg w-full max-w-4xl rounded-[28px] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-navy-active/10 via-card-bg to-card-bg border-b border-divider/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-navy-active text-white flex items-center justify-center shadow-md">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-text-primary">
                  Connect Real Greenhouse & Hosting Guide
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                  isHardwareConnected 
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                    : 'bg-amber-100 text-amber-700 border border-amber-300'
                }`}>
                  {isHardwareConnected ? '● REAL HARDWARE ONLINE' : '○ SIMULATION STANDBY'}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Flash your ESP32 microcontrollers to stream live sensor readings directly to this hosted dashboard.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-inner-bg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-text-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 bg-inner-bg/40 border-b border-divider/20 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-2 px-3.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 ${
              activeTab === 'status'
                ? 'border-navy-active text-navy-active bg-card-bg'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Connection Status</span>
          </button>

          <button
            onClick={() => setActiveTab('firmware-esp32')}
            className={`py-2 px-3.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 ${
              activeTab === 'firmware-esp32'
                ? 'border-navy-active text-navy-active bg-card-bg'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>ESP32 Main Firmware C++</span>
          </button>

          <button
            onClick={() => setActiveTab('firmware-cam')}
            className={`py-2 px-3.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 ${
              activeTab === 'firmware-cam'
                ? 'border-navy-active text-navy-active bg-card-bg'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>ESP32-CAM Vision Code</span>
          </button>

          <button
            onClick={() => setActiveTab('wiring')}
            className={`py-2 px-3.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 ${
              activeTab === 'wiring'
                ? 'border-navy-active text-navy-active bg-card-bg'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>GPIO Wiring Pinout</span>
          </button>

          <button
            onClick={() => setActiveTab('hosting-guide')}
            className={`py-2 px-3.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 ${
              activeTab === 'hosting-guide'
                ? 'border-navy-active text-navy-active bg-card-bg'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Cloud Hosting & Deployment</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-left space-y-5">
          
          {/* TAB 1: CONNECTION STATUS & CLOUD REST ENDPOINT */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              
              {/* Telemetry Ingestion URL Box */}
              <div className="bg-inner-bg p-4 rounded-2xl border border-divider/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary font-mono">
                    Cloud REST Telemetry Endpoint (Target for ESP32 POST requests)
                  </span>
                  <span className="text-[10px] text-emerald-600 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    HTTPS Live Ingress Active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={telemetryEndpoint}
                    className="w-full bg-card-bg border border-divider/40 text-text-primary font-mono text-xs px-3 py-2 rounded-xl focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy(telemetryEndpoint, 'url')}
                    className="py-2 px-3 bg-navy-active hover:bg-navy-active/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all shadow-xs"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
                  </button>
                </div>
              </div>

              {/* Hardware Heartbeat Indicator Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-inner-bg/60 p-4 rounded-2xl border border-divider/20 space-y-1">
                  <span className="text-[10px] text-text-secondary uppercase font-bold font-mono">ESP32 Main Link</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${isHardwareConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`} />
                    <span className="text-sm font-bold text-text-primary">
                      {isHardwareConnected ? 'Online & Streaming' : 'Standby / Ready to Receive'}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-secondary font-mono block">
                    Last Packet: {lastHeartbeat ? new Date(lastHeartbeat).toLocaleTimeString() : 'None received yet'}
                  </span>
                </div>

                <div className="bg-inner-bg/60 p-4 rounded-2xl border border-divider/20 space-y-1">
                  <span className="text-[10px] text-text-secondary uppercase font-bold font-mono">Live Ingested Reading</span>
                  <p className="text-xs font-bold text-text-primary">
                    Temp: <strong className="text-navy-active font-mono">{sensorData.temperature}°C</strong> | Soil: <strong className="text-navy-active font-mono">{sensorData.soilMoisture}%</strong>
                  </p>
                  <p className="text-[10px] text-text-secondary font-mono">
                    NPK: N-{sensorData.nitrogen ?? 165} P-{sensorData.phosphorus ?? 48} K-{sensorData.potassium ?? 210} mg/kg
                  </p>
                </div>

                <div className="bg-inner-bg/60 p-4 rounded-2xl border border-divider/20 space-y-1">
                  <span className="text-[10px] text-text-secondary uppercase font-bold font-mono">Data Source Mode</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleLiveHardwareMode(!isLiveHardwareMode)}
                      className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                        isLiveHardwareMode ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        isLiveHardwareMode ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                    <span className="text-xs font-bold text-text-primary">
                      {isLiveHardwareMode ? 'Strict Real Hardware' : 'Simulator Fallback'}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-secondary">
                    {isLiveHardwareMode ? 'Dashboard strictly displays physical ESP32 data.' : 'Synthesizes microclimate if hardware is offline.'}
                  </span>
                </div>
              </div>

              {/* 5-Step Quick Setup Guide */}
              <div className="bg-inner-bg/40 p-4 rounded-2xl border border-divider/20 space-y-3">
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-navy-active" />
                  Quick 5-Minute Hardware Connection Steps:
                </h4>
                <ol className="space-y-2 text-xs text-text-secondary list-decimal pl-4">
                  <li>
                    <strong className="text-text-primary">Open Arduino IDE:</strong> Install the <code>ArduinoJson</code> (v6.x/v7.x) and <code>DHT sensor library</code> via Library Manager.
                  </li>
                  <li>
                    <strong className="text-text-primary">Copy C++ Firmware:</strong> Go to the <strong>ESP32 Main Firmware</strong> tab above and click <em>Copy Complete C++ Code</em>.
                  </li>
                  <li>
                    <strong className="text-text-primary">Set WiFi Credentials:</strong> In line 18, replace <code>YOUR_GREENHOUSE_WIFI_SSID</code> and <code>YOUR_GREENHOUSE_WIFI_PASSWORD</code> with your router credentials.
                  </li>
                  <li>
                    <strong className="text-text-primary">Flash to ESP32:</strong> Select board <em>"ESP32 Dev Module"</em> and click <em>Upload</em>.
                  </li>
                  <li>
                    <strong className="text-text-primary">Power On in Greenhouse:</strong> Once booted, the ESP32 will automatically connect to WiFi and POST live sensor values to this URL every 5 seconds!
                  </li>
                </ol>
              </div>

            </div>
          )}

          {/* TAB 2: ESP32 MAIN FIRMWARE C++ CODE */}
          {activeTab === 'firmware-esp32' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">
                    Arduino IDE C++ Sketch: Greenhouse Multi-Sensor & Relay Controller
                  </h4>
                  <p className="text-xs text-text-secondary">
                    Includes automatic DHT22, Capacitive Soil, LDR, Modbus RS485 NPK reading, and cloud relay control synchronization.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(esp32Code, 'esp32')}
                  className="py-2 px-3.5 bg-navy-active hover:bg-navy-active/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-xs"
                >
                  {copiedEsp32 ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEsp32 ? 'Copied C++ Code!' : 'Copy Complete C++ Code'}</span>
                </button>
              </div>

              <div className="relative bg-slate-950 rounded-2xl p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-[380px] border border-white/10 shadow-inner">
                {isLoadingCode ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-text-secondary">
                    <RefreshCw className="w-4 h-4 animate-spin text-navy-active" />
                    <span>Compiling latest cloud firmware configuration...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre">{esp32Code}</pre>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ESP32-CAM DUAL VISION CODE */}
          {activeTab === 'firmware-cam' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">
                    ESP32-CAM Dual Camera Node Firmware (UXGA 1600x1200)
                  </h4>
                  <p className="text-xs text-text-secondary">
                    Captures high-resolution frames of Ceylon Chilli leaves and streams them to the AI Vision Diagnosis engine.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(esp32CamCode, 'cam')}
                  className="py-2 px-3.5 bg-navy-active hover:bg-navy-active/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-xs"
                >
                  {copiedCam ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCam ? 'Copied Camera Code!' : 'Copy Camera C++ Code'}</span>
                </button>
              </div>

              <div className="relative bg-slate-950 rounded-2xl p-4 font-mono text-xs text-sky-400 overflow-x-auto max-h-[380px] border border-white/10 shadow-inner">
                {isLoadingCode ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-text-secondary">
                    <RefreshCw className="w-4 h-4 animate-spin text-navy-active" />
                    <span>Loading camera firmware...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre">{esp32CamCode}</pre>
                )}
              </div>
            </div>
          )}


          {/* TAB 4: GPIO WIRING PINOUT */}
          {activeTab === 'wiring' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-text-primary">
                ESP32-S3-DevKitC-1 Hardware Pin Assignment Table
              </h4>
              <p className="text-xs text-text-secondary">
                These GPIOs avoid the ESP32-S3 strapping pins (0, 3, 45, 46), the native-USB pins
                (19, 20), the UART0 debug pins used by Serial (43, 44), and the SPI flash / octal
                PSRAM pins (26-37 on R8 modules) &mdash; safe on both the official DevKitC-1 board and
                bare WROOM-1 breakouts.
              </p>
              <div className="overflow-x-auto border border-divider/20 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-inner-bg text-[11px] font-mono uppercase text-text-secondary border-b border-divider/20">
                    <tr>
                      <th className="p-3">Component</th>
                      <th className="p-3">Sensor / Module Pin</th>
                      <th className="p-3">ESP32-S3 Pin</th>
                      <th className="p-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider/10 font-mono">
                    <tr className="hover:bg-inner-bg/40">
                      <td className="p-3 font-bold text-text-primary">DHT22 / AM2302</td>
                      <td className="p-3 text-text-secondary">Data (Pin 2)</td>
                      <td className="p-3 font-bold text-emerald-600">GPIO 4</td>
                      <td className="p-3 text-text-secondary">Air Temperature & Humidity (with 10k pullup)</td>
                    </tr>
                    <tr className="hover:bg-inner-bg/40">
                      <td className="p-3 font-bold text-text-primary">Capacitive Soil Moisture</td>
                      <td className="p-3 text-text-secondary">AOUT (Analog Out)</td>
                      <td className="p-3 font-bold text-emerald-600">GPIO 1 (ADC1_CH0)</td>
                      <td className="p-3 text-text-secondary">Volumetric Soil Water Content (0-100%)</td>
                    </tr>
                    <tr className="hover:bg-inner-bg/40">
                      <td className="p-3 font-bold text-text-primary">LDR / Photoresistor</td>
                      <td className="p-3 text-text-secondary">AOUT (Analog Out)</td>
                      <td className="p-3 font-bold text-emerald-600">GPIO 2 (ADC1_CH1)</td>
                      <td className="p-3 text-text-secondary">Greenhouse Daylight Lux Measurement</td>
                    </tr>
                    <tr className="hover:bg-inner-bg/40">
                      <td className="p-3 font-bold text-text-primary">Relay 1 (Ventilation Fan)</td>
                      <td className="p-3 text-text-secondary">IN1</td>
                      <td className="p-3 font-bold text-emerald-600">GPIO 5</td>
                      <td className="p-3 text-text-secondary">Exhaust Fan AC / 12V DC Relay</td>
                    </tr>
                    <tr className="hover:bg-inner-bg/40">
                      <td className="p-3 font-bold text-text-primary">Relay 2 (Water Pump)</td>
                      <td className="p-3 text-text-secondary">IN2</td>
                      <td className="p-3 font-bold text-emerald-600">GPIO 6</td>
                      <td className="p-3 text-text-secondary">Micro-Drip Irrigation Solenoid / Pump</td>
                    </tr>
                    <tr className="hover:bg-inner-bg/40">
                      <td className="p-3 font-bold text-text-primary">Relay 3 (Grow LEDs)</td>
                      <td className="p-3 text-text-secondary">IN3</td>
                      <td className="p-3 font-bold text-emerald-600">GPIO 7</td>
                      <td className="p-3 text-text-secondary">Supplementary Horticultural LED Bars</td>
                    </tr>
                    <tr className="hover:bg-inner-bg/40">
                      <td className="p-3 font-bold text-text-primary">OLED Display (SSD1306)</td>
                      <td className="p-3 text-text-secondary">SDA</td>
                      <td className="p-3 font-bold text-emerald-600">GPIO 8</td>
                      <td className="p-3 text-text-secondary">128x64 I2C On-Site Live Readout</td>
                    </tr>
                    <tr className="hover:bg-inner-bg/40">
                      <td className="p-3 font-bold text-text-primary">OLED Display (SSD1306)</td>
                      <td className="p-3 text-text-secondary">SCL</td>
                      <td className="p-3 font-bold text-emerald-600">GPIO 9</td>
                      <td className="p-3 text-text-secondary">128x64 I2C On-Site Live Readout</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: HOSTING & CLOUD DEPLOYMENT GUIDE */}
          {activeTab === 'hosting-guide' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>How to Host on Your Own Custom Web Server (VPS / Cloud / Raspberry Pi)</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  This full-stack codebase is 100% self-contained (React 19 Frontend + Express.js Backend + ESP32 Endpoints). You can deploy it to any server with Node.js or Docker in minutes.
                </p>
              </div>

              {/* Step 1: Export Code */}
              <div className="bg-inner-bg p-4 rounded-2xl border border-divider/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                  <span className="w-5 h-5 rounded-full bg-navy-active text-white flex items-center justify-center text-[11px]">1</span>
                  <span>Export Codebase</span>
                </div>
                <p className="text-xs text-text-secondary">
                  Open the <strong>Settings Menu</strong> (top right in Google AI Studio) &gt; click <strong>"Export to GitHub"</strong> or <strong>"Download ZIP"</strong>.
                </p>
              </div>

              {/* Step 2: Deployment Methods Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Method A: Docker (Recommended) */}
                <div className="bg-inner-bg p-4 rounded-2xl border border-divider/20 space-y-2 flex flex-col justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-navy-active" />
                      Option A: Docker / Docker Compose
                    </h5>
                    <p className="text-xs text-text-secondary mt-1">
                      The project includes a ready-to-run <code>Dockerfile</code> and <code>docker-compose.yml</code>.
                    </p>
                    <div className="bg-slate-950 p-2.5 rounded-xl font-mono text-[11px] text-emerald-400 mt-2 space-y-1">
                      <p># Run with Docker Compose</p>
                      <p>docker compose up -d --build</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-secondary font-mono mt-2 block">
                    Runs production container on port 3000
                  </span>
                </div>

                {/* Method B: Linux VPS (Ubuntu / Debian / Raspberry Pi) */}
                <div className="bg-inner-bg p-4 rounded-2xl border border-divider/20 space-y-2 flex flex-col justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-navy-active" />
                      Option B: Node.js + PM2 (Ubuntu / VPS)
                    </h5>
                    <p className="text-xs text-text-secondary mt-1">
                      Direct native Node.js 20+ execution on any Linux server:
                    </p>
                    <div className="bg-slate-950 p-2.5 rounded-xl font-mono text-[11px] text-emerald-400 mt-2 space-y-1">
                      <p>npm install</p>
                      <p>npm run build</p>
                      <p>pm2 start dist/server.cjs --name "greenhouse"</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-secondary font-mono mt-2 block">
                    Auto-restarts on server reboot
                  </span>
                </div>

              </div>

              {/* Step 3: Pointing ESP32 to your new server */}
              <div className="bg-inner-bg/60 p-4 rounded-2xl border border-divider/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                  <span className="w-5 h-5 rounded-full bg-navy-active text-white flex items-center justify-center text-[11px]">2</span>
                  <span>Update ESP32 Target Server URL</span>
                </div>
                <p className="text-xs text-text-secondary">
                  Once your server is running (e.g. at <code>http://your-server-ip:3000</code> or <code>https://greenhouse.yourdomain.com</code>), change <strong>line 21</strong> in the ESP32 C++ firmware sketch:
                </p>
                <div className="bg-slate-950 p-2.5 rounded-xl font-mono text-xs text-sky-400">
                  const char* SERVER_ENDPOINT = "http://YOUR_SERVER_IP:3000/api/telemetry";
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-inner-bg/60 border-t border-divider/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-text-secondary font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Target: {currentHost}</span>
          </div>

          <button
            onClick={onClose}
            className="py-2 px-5 bg-navy-active hover:bg-navy-active/90 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
