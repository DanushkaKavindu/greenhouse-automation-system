import React, { useState, useEffect, useRef } from 'react';
import { Camera, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Eye, Play, Square, Sparkles, Clock, Layers, Activity, ChevronRight, Check } from 'lucide-react';
import { DiseaseDetectionHistory } from '../types';

interface DualCamDiagnosis {
  id: string;
  cameraNodeId: 'ESP32-CAM 01 (Top View)' | 'ESP32-CAM 02 (Side/Leaf View)';
  diseaseName: string;
  confidence: number;
  severity: 'Healthy' | 'Warning' | 'Critical';
  timestamp: string;
  treatment: string[];
  preventive: string[];
  viewType: 'top' | 'side';
  bbox: { x: number; y: number; width: number; height: number; label: string };
  symptoms: string[];
}

interface DiseaseDetectorProps {
  onAddHistory: (item: DiseaseDetectionHistory) => void;
  history: DiseaseDetectionHistory[];
}

export default function DiseaseDetector({ onAddHistory, history }: DiseaseDetectorProps) {
  // Active selected view for display
  const [selectedCamTab, setSelectedCamTab] = useState<'both' | 'cam1' | 'cam2'>('both');
  const [activeDiagnosticNode, setActiveDiagnosticNode] = useState<'cam1' | 'cam2'>('cam2');
  
  // Scanning state & timer
  const [isScanning, setIsScanning] = useState(false);
  const [autoScanInterval, setAutoScanInterval] = useState<number>(600); // 10 mins (600s) default
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(true);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Diagnostic Results
  const [cam1Result, setCam1Result] = useState<DualCamDiagnosis | null>(null);
  const [cam2Result, setCam2Result] = useState<DualCamDiagnosis | null>(null);

  // Countdown timer effect
  useEffect(() => {
    if (!autoScanEnabled) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          triggerDualCapture();
          return autoScanInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoScanEnabled, autoScanInterval]);

  // Update countdown when interval option changes
  const handleIntervalChange = (seconds: number) => {
    setAutoScanInterval(seconds);
    setSecondsRemaining(seconds);
  };

  // Format MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Trigger automated or manual capture from both ESP32-CAM nodes
  const triggerDualCapture = async () => {
    setIsScanning(true);
    try {
      // Simulate real-time hardware sync latency
      await new Promise(r => setTimeout(r, 1200));

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toISOString().split('T')[0];

      // Simulated realistic pathological evaluation from dual angles
      const conditions = [
        {
          name: 'Healthy Ceylon Green Chilli',
          severity: 'Healthy' as const,
          confidence: 97,
          symptoms: ['Symmetric leaf venation', 'High chlorophyll density in apical leaves', 'Normal vegetative branching'],
          treatment: ['No corrective action required. Maintain current fertigation regime.'],
          preventive: ['Maintain weekly insect netting inspections', 'Keep ambient humidity below 75% during dark hours'],
          bbox1: { x: 25, y: 30, width: 50, height: 45, label: 'Healthy Canopy (98%)' },
          bbox2: { x: 30, y: 35, width: 45, height: 40, label: 'Healthy Leaf Foliage (97%)' }
        },
        {
          name: 'Chilli Leaf Curl Virus (ChiLCV)',
          severity: 'Warning' as const,
          confidence: 93,
          symptoms: ['Upward curling of leaf margins', 'Stunted apical shoots and shortened internodes', 'Vein clearing on young foliage'],
          treatment: [
            'Rogue and remove severely curled leaves to prevent viral spread.',
            'Apply organic neem seed kernel extract (NSKE 5%) spray early morning.',
            'Introduce biological vector traps to control whiteflies (Bemisia tabaci).'
          ],
          preventive: [
            'Install yellow sticky sheets (1 trap per 10m²).',
            'Enclose greenhouse vents with 50-mesh nylon insect-proof netting.'
          ],
          bbox1: { x: 35, y: 25, width: 40, height: 35, label: 'Apical Curl Vector (92%)' },
          bbox2: { x: 28, y: 22, width: 48, height: 50, label: 'ChiLCV Leaf Curl (94%)' }
        },
        {
          name: 'Anthracnose (Colletotrichum capsici)',
          severity: 'Critical' as const,
          confidence: 95,
          symptoms: ['Circular sunken necrotic lesions on chilli pods', 'Concentric rings of acervuli spores', 'Premature leaf drop'],
          treatment: [
            'Prune and safely incinerate all spotted leaves and infected chilli pods.',
            'Apply copper-based bio-fungicide or Bordeaux mixture (1%) immediately.',
            'Suspend overhead foliar misting; switch exclusively to sub-surface drip.'
          ],
          preventive: [
            'Ensure adequate plant spacing of 45-60cm for maximum air circulation.',
            'Apply certified Trichoderma viride bio-agent to soil base.'
          ],
          bbox1: { x: 20, y: 40, width: 35, height: 40, label: 'Canopy Lesion Spot (91%)' },
          bbox2: { x: 32, y: 30, width: 42, height: 46, label: 'Anthracnose Lesion (95%)' }
        }
      ];

      // Pick scenario
      const selected = conditions[Math.floor(Math.random() * conditions.length)];

      const node1Data: DualCamDiagnosis = {
        id: 'diag_cam1_' + Date.now(),
        cameraNodeId: 'ESP32-CAM 01 (Top View)',
        diseaseName: selected.name,
        confidence: selected.confidence,
        severity: selected.severity,
        timestamp: timeStr,
        treatment: selected.treatment,
        preventive: selected.preventive,
        viewType: 'top',
        bbox: selected.bbox1,
        symptoms: selected.symptoms,
      };

      const node2Data: DualCamDiagnosis = {
        id: 'diag_cam2_' + Date.now(),
        cameraNodeId: 'ESP32-CAM 02 (Side/Leaf View)',
        diseaseName: selected.name,
        confidence: selected.confidence,
        severity: selected.severity,
        timestamp: timeStr,
        treatment: selected.treatment,
        preventive: selected.preventive,
        viewType: 'side',
        bbox: selected.bbox2,
        symptoms: selected.symptoms,
      };

      setCam1Result(node1Data);
      setCam2Result(node2Data);
      setLastScanTime(timeStr);
      setSecondsRemaining(autoScanInterval);

      // Log into historical database
      const historyEntry: DiseaseDetectionHistory = {
        id: 'hist_' + Date.now(),
        diseaseName: `${selected.name} (${node2Data.cameraNodeId.includes('02') ? 'CAM 02' : 'CAM 01'})`,
        confidence: selected.confidence,
        severity: selected.severity,
        timestamp: `${dateStr} ${timeStr}`,
        treatment: selected.treatment,
        preventive: selected.preventive,
      };
      onAddHistory(historyEntry);

    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  const activeResult = activeDiagnosticNode === 'cam1' ? cam1Result : cam2Result;

  return (
    <div id="dual-esp32cam-ai-panel" className="space-y-6 text-left select-none">
      
      {/* Top Main 2-Column Grid: Left (Dual Camera Feed & Controls), Right (AI Diagnostics) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT PANEL: Dual ESP32-CAM Feed & Automated Capture Controls (7 Cols) */}
        <div className="lg:col-span-7 bg-card-bg rounded-[26px] p-5 sm:p-6 shadow-glass border border-white/20 flex flex-col justify-between space-y-5">
          
          {/* Panel Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-divider/20 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-base sm:text-lg font-bold text-text-primary">
                  Dual ESP32-CAM Vision Stream
                </h3>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Automated synchronous multi-angle plant inspection and pathology telemetry.
              </p>
            </div>

            {/* View Selector Tabs */}
            <div className="bg-inner-bg p-1 rounded-xl flex items-center gap-1 text-[11px] font-semibold border border-divider/20 self-start sm:self-auto shrink-0">
              <button
                onClick={() => setSelectedCamTab('both')}
                className={`py-1.5 px-2.5 rounded-lg transition-all ${
                  selectedCamTab === 'both' ? 'bg-navy-active text-white font-bold shadow-2xs' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Dual Grid
              </button>
              <button
                onClick={() => setSelectedCamTab('cam1')}
                className={`py-1.5 px-2.5 rounded-lg transition-all ${
                  selectedCamTab === 'cam1' ? 'bg-navy-active text-white font-bold shadow-2xs' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                CAM 01 (Top)
              </button>
              <button
                onClick={() => setSelectedCamTab('cam2')}
                className={`py-1.5 px-2.5 rounded-lg transition-all ${
                  selectedCamTab === 'cam2' ? 'bg-navy-active text-white font-bold shadow-2xs' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                CAM 02 (Side)
              </button>
            </div>
          </div>

          {/* Camera Viewports Area */}
          <div className={`grid gap-4 ${selectedCamTab === 'both' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            
            {/* CAMERA 01: Top View */}
            {(selectedCamTab === 'both' || selectedCamTab === 'cam1') && (
              <div className="bg-slate-950 rounded-2xl overflow-hidden border border-white/10 relative shadow-inner flex flex-col justify-between min-h-[220px]">
                {/* Header overlay */}
                <div className="p-2.5 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono font-bold">ESP32-CAM 01</span>
                    <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      TOP VIEW
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-white/60">15 FPS · UXGA</span>
                </div>

                {/* SVG Visual Video Render */}
                <div className="relative flex-1 flex items-center justify-center p-2 bg-slate-900/90 overflow-hidden">
                  <svg className="w-full h-40 max-h-44 object-contain" viewBox="0 0 320 200" fill="none">
                    <rect width="320" height="200" fill="#090d16"/>
                    {/* Perspective grid lines */}
                    <circle cx="160" cy="100" r="85" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3"/>
                    <circle cx="160" cy="100" r="55" stroke="#1e293b" strokeWidth="1"/>
                    <line x1="160" y1="10" x2="160" y2="190" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2"/>
                    <line x1="20" y1="100" x2="300" y2="100" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2"/>

                    {/* Top Canopy foliage leaves */}
                    <ellipse cx="160" cy="100" rx="35" ry="35" fill="#047857" opacity="0.9"/>
                    <ellipse cx="130" cy="85" rx="38" ry="20" fill="#10b981" transform="rotate(-30 130 85)" opacity="0.85"/>
                    <ellipse cx="190" cy="85" rx="38" ry="20" fill="#10b981" transform="rotate(30 190 85)" opacity="0.85"/>
                    <ellipse cx="135" cy="120" rx="35" ry="18" fill="#059669" transform="rotate(35 135 120)" opacity="0.85"/>
                    <ellipse cx="185" cy="120" rx="35" ry="18" fill="#059669" transform="rotate(-35 185 120)" opacity="0.85"/>
                    <circle cx="160" cy="100" r="14" fill="#34d399" opacity="0.95"/>
                    
                    {/* Apical shoot buds */}
                    <circle cx="158" cy="98" r="4" fill="#fbbf24"/>
                    <circle cx="163" cy="102" r="3.5" fill="#fbbf24"/>

                    {/* AI Bounding overlay if diagnosed */}
                    {cam1Result && (
                      <g>
                        <rect x="95" y="45" width="130" height="110" fill="none" stroke={cam1Result.severity === 'Healthy' ? '#10b981' : '#f59e0b'} strokeWidth="1.5" strokeDasharray="4,2" rx="6"/>
                        <rect x="95" y="28" width="130" height="16" fill={cam1Result.severity === 'Healthy' ? '#10b981' : '#f59e0b'} rx="3"/>
                        <text x="100" y="40" fill="#ffffff" fontFamily="monospace" fontSize="8.5" fontWeight="bold">
                          {cam1Result.bbox.label}
                        </text>
                      </g>
                    )}
                  </svg>

                  {/* Scanning Animation Sweep */}
                  {isScanning && (
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent animate-pulse pointer-events-none" />
                  )}
                </div>

                {/* Footer metadata */}
                <div className="p-2 bg-black/80 flex items-center justify-between text-[9px] font-mono text-white/70 border-t border-white/5">
                  <span>IP: 192.168.1.105:81</span>
                  <span className="text-emerald-400 font-semibold">SIGNAL: -58 dBm (EXCELLENT)</span>
                </div>
              </div>
            )}

            {/* CAMERA 02: Side / Macro Leaf View */}
            {(selectedCamTab === 'both' || selectedCamTab === 'cam2') && (
              <div className="bg-slate-950 rounded-2xl overflow-hidden border border-white/10 relative shadow-inner flex flex-col justify-between min-h-[220px]">
                {/* Header overlay */}
                <div className="p-2.5 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono font-bold">ESP32-CAM 02</span>
                    <span className="text-[9px] font-mono text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-500/30">
                      SIDE/LEAF VIEW
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-white/60">18 FPS · UXGA</span>
                </div>

                {/* SVG Visual Video Render */}
                <div className="relative flex-1 flex items-center justify-center p-2 bg-slate-900/90 overflow-hidden">
                  <svg className="w-full h-40 max-h-44 object-contain" viewBox="0 0 320 200" fill="none">
                    <rect width="320" height="200" fill="#090d16"/>
                    
                    {/* Stem & Branch structure */}
                    <path d="M 160 190 Q 155 120 160 30" stroke="#047857" strokeWidth="6" fill="none"/>
                    
                    {/* Foliage leaves */}
                    <ellipse cx="120" cy="120" rx="38" ry="18" fill="#10b981" transform="rotate(-25 120 120)" opacity="0.9"/>
                    <ellipse cx="200" cy="100" rx="42" ry="20" fill="#10b981" transform="rotate(20 200 100)" opacity="0.9"/>
                    <ellipse cx="115" cy="70" rx="35" ry="16" fill="#34d399" transform="rotate(-35 115 70)" opacity="0.9"/>
                    <ellipse cx="205" cy="55" rx="36" ry="17" fill="#34d399" transform="rotate(30 205 55)" opacity="0.9"/>
                    
                    {/* Green Chilli Pod */}
                    <path d="M 130 115 Q 120 150 115 170" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" fill="none"/>
                    <path d="M 195 95 Q 210 135 215 155" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" fill="none"/>

                    {/* AI Bounding overlay if diagnosed */}
                    {cam2Result && (
                      <g>
                        <rect x="75" y="40" width="170" height="120" fill="none" stroke={cam2Result.severity === 'Healthy' ? '#10b981' : cam2Result.severity === 'Warning' ? '#f59e0b' : '#ef4444'} strokeWidth="1.5" strokeDasharray="4,2" rx="6"/>
                        <rect x="75" y="24" width="170" height="16" fill={cam2Result.severity === 'Healthy' ? '#10b981' : cam2Result.severity === 'Warning' ? '#f59e0b' : '#ef4444'} rx="3"/>
                        <text x="80" y="36" fill="#ffffff" fontFamily="monospace" fontSize="8.5" fontWeight="bold">
                          {cam2Result.bbox.label}
                        </text>
                      </g>
                    )}
                  </svg>

                  {/* Scanning Animation Sweep */}
                  {isScanning && (
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-sky-500/20 to-transparent animate-pulse pointer-events-none" />
                  )}
                </div>

                {/* Footer metadata */}
                <div className="p-2 bg-black/80 flex items-center justify-between text-[9px] font-mono text-white/70 border-t border-white/5">
                  <span>IP: 192.168.1.106:81</span>
                  <span className="text-emerald-400 font-semibold">SIGNAL: -62 dBm (STABLE)</span>
                </div>
              </div>
            )}

          </div>

          {/* Automation Schedule & Instant Snap Controls Bar */}
          <div className="p-4 bg-inner-bg/60 rounded-2xl border border-divider/25 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
            
            {/* Auto-Scan Interval Controls */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                    autoScanEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title="Toggle Automated Scheduled Scanning"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    autoScanEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
                <span className="text-xs font-semibold text-text-primary">Auto-Scan</span>
              </div>

              <select
                value={autoScanInterval}
                disabled={!autoScanEnabled}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="bg-card-bg border border-divider/30 text-text-primary text-xs rounded-xl px-2.5 py-1.5 font-mono focus:outline-none focus:border-navy-active disabled:opacity-50"
              >
                <option value={30}>Every 30 Seconds (Fast Demo)</option>
                <option value={600}>Every 10 Minutes</option>
                <option value={1800}>Every 30 Minutes</option>
                <option value={3600}>Every 1 Hour</option>
              </select>

              {autoScanEnabled && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-navy-active font-bold bg-white/70 py-1 px-2 rounded-lg border border-divider/20">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Next in {formatTime(secondsRemaining)}</span>
                </div>
              )}
            </div>

            {/* Manual Capture Button */}
            <button
              onClick={triggerDualCapture}
              disabled={isScanning}
              className="py-2.5 px-4 bg-navy-active hover:bg-navy-active/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50 min-h-[40px] shrink-0"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
                  <span>Snapping & Diagnosing...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Capture & Analyze Now</span>
                </>
              )}
            </button>

          </div>

        </div>

        {/* RIGHT PANEL: Real-Time Diagnostic Output (5 Cols) */}
        <div className="lg:col-span-5 bg-card-bg rounded-[26px] p-5 sm:p-6 shadow-glass border border-white/20 flex flex-col justify-between space-y-4">
          
          {activeResult ? (
            <div className="space-y-4 h-full flex flex-col justify-between">
              
              {/* Header & Camera Node Switcher */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider block font-mono">
                    AI PATHOLOGY TELEMETRY
                  </span>
                  
                  {/* Switch between CAM 01 & CAM 02 findings */}
                  <div className="bg-inner-bg p-0.5 rounded-lg flex items-center text-[10px] font-mono font-bold border border-divider/20">
                    <button
                      onClick={() => setActiveDiagnosticNode('cam1')}
                      className={`px-2 py-0.5 rounded transition-all ${
                        activeDiagnosticNode === 'cam1' ? 'bg-navy-active text-white' : 'text-text-secondary'
                      }`}
                    >
                      Node 01
                    </button>
                    <button
                      onClick={() => setActiveDiagnosticNode('cam2')}
                      className={`px-2 py-0.5 rounded transition-all ${
                        activeDiagnosticNode === 'cam2' ? 'bg-navy-active text-white' : 'text-text-secondary'
                      }`}
                    >
                      Node 02
                    </button>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary leading-tight">
                      {activeResult.diseaseName}
                    </h3>
                    <span className="text-[11px] font-mono text-text-secondary block mt-0.5">
                      Source: <strong className="text-text-primary">{activeResult.cameraNodeId}</strong>
                    </span>
                  </div>

                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 ${
                    activeResult.severity === 'Healthy' ? 'bg-emerald-50 text-status-healthy border border-emerald-200' :
                    activeResult.severity === 'Warning' ? 'bg-amber-50 text-status-warning border border-amber-200' : 'bg-red-50 text-status-critical border border-red-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      activeResult.severity === 'Healthy' ? 'bg-status-healthy' :
                      activeResult.severity === 'Warning' ? 'bg-status-warning' : 'bg-status-critical'
                    }`} />
                    {activeResult.severity}
                  </div>
                </div>

                {/* Score & Timestamp Bar */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-inner-bg/60 p-2.5 rounded-xl border border-divider/20">
                    <span className="text-[9px] text-text-secondary uppercase block font-sans font-bold">Confidence Score</span>
                    <span className="font-extrabold text-text-primary text-sm">{activeResult.confidence}%</span>
                  </div>
                  <div className="bg-inner-bg/60 p-2.5 rounded-xl border border-divider/20">
                    <span className="text-[9px] text-text-secondary uppercase block font-sans font-bold">Last Automated Scan</span>
                    <span className="font-bold text-text-primary text-xs">{activeResult.timestamp}</span>
                  </div>
                </div>

                {/* Pathological Symptoms */}
                <div className="space-y-1.5 text-xs">
                  <h4 className="text-[11px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-navy-active" />
                    Observed Plant Symptoms:
                  </h4>
                  <ul className="space-y-1 pl-1">
                    {activeResult.symptoms.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-text-secondary text-[11px]">
                        <span className="text-navy-active font-bold">›</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Organo-Treatment Recommendations */}
                <div className="space-y-1.5 text-xs pt-1">
                  <h4 className="text-[11px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Organo-Treatment Recommendations:
                  </h4>
                  <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100 space-y-1">
                    {activeResult.treatment.map((t, idx) => (
                      <p key={idx} className="text-[11px] text-text-primary leading-tight">
                        • {t}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Preventive Protocol */}
                <div className="space-y-1.5 text-xs pt-1">
                  <h4 className="text-[11px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-navy-active" />
                    Preventive Biosecurity:
                  </h4>
                  <div className="bg-inner-bg/60 rounded-xl p-2.5 border border-divider/20 space-y-1">
                    {activeResult.preventive.map((p, idx) => (
                      <p key={idx} className="text-[11px] text-text-secondary leading-tight">
                        • {p}
                      </p>
                    ))}
                  </div>
                </div>

              </div>

              <div className="pt-2 border-t border-divider/30 flex items-center justify-between text-[10px] font-mono text-text-secondary">
                <span>Node: {activeResult.cameraNodeId.split(' ')[0]}</span>
                <span className="text-emerald-600 font-bold">Gemini AI Model Sync: Active</span>
              </div>
            </div>
          ) : (
            /* Empty State when waiting for first scan */
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 my-auto">
              <div className="w-16 h-16 rounded-full bg-inner-bg flex items-center justify-center text-text-secondary relative">
                <Camera className="w-8 h-8 stroke-[1.5] text-navy-active" />
                <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <div className="space-y-2 max-w-xs">
                <h4 className="text-sm font-bold text-text-primary">
                  Monitoring ESP32-CAM Feeds...
                </h4>
                <p className="text-xs text-text-secondary">
                  Next scheduled automated scan in <strong className="font-mono text-navy-active font-bold">[{formatTime(secondsRemaining)}]</strong>
                </p>
                <p className="text-[11px] text-text-secondary/80">
                  Live dual video feeds are receiving frames. Click "Capture & Analyze Now" to run an immediate diagnostic.
                </p>
              </div>

              <button
                onClick={triggerDualCapture}
                className="py-2 px-4 bg-inner-bg hover:bg-white text-navy-active border border-divider/30 rounded-xl text-xs font-bold font-mono transition-all shadow-2xs"
              >
                Trigger Initial Snap
              </button>
            </div>
          )}

        </div>

      </div>

      {/* BOTTOM PANEL: Historic Automated Diagnoses Logs */}
      <div className="bg-card-bg rounded-[26px] p-5 sm:p-6 shadow-glass border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono flex items-center gap-2">
            <Layers className="w-4 h-4 text-navy-active" />
            Historic Dual-CAM Diagnoses Logs
          </h3>
          <span className="text-[10px] font-mono text-text-secondary">
            Total Scans Logged: {history.length}
          </span>
        </div>

        {history.length > 0 ? (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-inner-bg/40 hover:bg-inner-bg/75 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all border border-divider/10"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-lg bg-navy-active/10 text-navy-active flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">{item.diseaseName}</h4>
                    <span className="text-[10px] text-text-secondary font-mono block">
                      Timestamp: {item.timestamp}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pl-12 sm:pl-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[9px] text-text-secondary block font-mono">Confidence</span>
                    <span className="text-xs font-bold text-text-primary font-mono">{item.confidence}%</span>
                  </div>
                  <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase ${
                    item.severity === 'Healthy' ? 'bg-green-50 text-status-healthy' :
                    item.severity === 'Warning' ? 'bg-amber-50 text-status-warning' : 'bg-red-50 text-status-critical'
                  }`}>
                    {item.severity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-xs text-text-secondary py-6 font-mono">
            No diagnostic history logs yet. Automated scans will populate records here.
          </div>
        )}
      </div>

    </div>
  );
}
