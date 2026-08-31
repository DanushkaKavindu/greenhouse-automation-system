import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Camera, RefreshCw, Upload, ShieldCheck, AlertTriangle, CheckCircle2, Cpu, Wifi, Ruler, Code, Copy, Check, Sparkles, Activity, Layers, ArrowUpRight, Play, Square, Eye, EyeOff, VideoOff } from 'lucide-react';
import { ESP32CamFrame } from '../types';

interface ESP32CamFeedProps {
  onUpdatePlantHeight?: (heightCm: number) => void;
  onUpdateHealthScore?: (score: number) => void;
}

export default function ESP32CamFeed({ onUpdatePlantHeight, onUpdateHealthScore }: ESP32CamFeedProps) {
  const [latestFrame, setLatestFrame] = useState<ESP32CamFrame | null>(null);
  const [history, setHistory] = useState<ESP32CamFrame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturingWebcam, setIsCapturingWebcam] = useState(false);
  const [isWebcamDisabled, setIsWebcamDisabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off, else seconds
  const [showArduinoCodeModal, setShowArduinoCodeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [arduinoCode, setArduinoCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'feed' | 'growth' | 'disease' | 'code'>('feed');
  const [imageError, setImageError] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch Latest Frame & History on Mount
  const fetchLatestData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/esp32cam/latest');
      if (res.ok) {
        const data = await res.json();
        setLatestFrame(data.frame);
        if (data.frame && onUpdatePlantHeight) {
          onUpdatePlantHeight(data.frame.growth.plantHeightCm);
        }
        if (data.frame && onUpdateHealthScore) {
          onUpdateHealthScore(data.frame.growth.healthScore);
        }
      }

      const histRes = await fetch('/api/esp32cam/history');
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.history || []);
      }
    } catch (err) {
      console.error('Error fetching ESP32-CAM feed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestData();
  }, []);

  // Fetch C++ Arduino Code when modal opens or tab switches
  useEffect(() => {
    if (showArduinoCodeModal || activeTab === 'code') {
      fetch('/api/esp32cam/code')
        .then(res => res.text())
        .then(code => setArduinoCode(code))
        .catch(err => console.error('Error fetching Arduino code:', err));
    }
  }, [showArduinoCodeModal, activeTab]);

  // Auto-Refresh polling timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      triggerCapture();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  // Trigger simulated/manual camera capture
  const triggerCapture = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/esp32cam/trigger-capture', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLatestFrame(data.frame);
        setHistory(prev => [data.frame, ...prev.slice(0, 19)]);
        if (data.frame && onUpdatePlantHeight) {
          onUpdatePlantHeight(data.frame.growth.plantHeightCm);
        }
        if (data.frame && onUpdateHealthScore) {
          onUpdateHealthScore(data.frame.growth.healthScore);
        }
      }
    } catch (err) {
      console.error('Error triggering capture:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload local image from device file input
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      try {
        const res = await fetch('/api/esp32cam/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Data,
            mimeType: file.type,
            source: 'esp32_cam',
          })
        });
        if (res.ok) {
          const data = await res.json();
          setLatestFrame(data.frame);
          setHistory(prev => [data.frame, ...prev.slice(0, 19)]);
          if (data.frame && onUpdatePlantHeight) {
            onUpdatePlantHeight(data.frame.growth.plantHeightCm);
          }
          if (data.frame && onUpdateHealthScore) {
            onUpdateHealthScore(data.frame.growth.healthScore);
          }
        }
      } catch (err) {
        console.error('Error uploading image to ESP32 API:', err);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Stop webcam stream cleanly
  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCapturingWebcam(false);
  };

  // Start webcam stream
  const startWebcam = async () => {
    if (isWebcamDisabled) {
      alert('Webcam input is currently disabled. Enable webcam mode in the controls bar below.');
      return;
    }
    try {
      setIsCapturingWebcam(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Webcam access error:', err);
      alert('Could not access laptop/phone camera. Ensure camera permissions are allowed.');
      setIsCapturingWebcam(false);
    }
  };

  const captureWebcamFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');

      // Stop webcam tracks cleanly
      stopWebcam();

      // Post captured frame to backend
      fetch('/api/esp32cam/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          mimeType: 'image/jpeg',
          source: 'webcam',
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.frame) {
          setLatestFrame(data.frame);
          setHistory(prev => [data.frame, ...prev.slice(0, 19)]);
        }
      });
    }
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(arduinoCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  if (!latestFrame) {
    return (
      <div className="bg-card-bg rounded-[24px] p-8 text-center space-y-4 border border-divider/20 shadow-glass">
        <RefreshCw className="w-8 h-8 text-navy-active animate-spin mx-auto" />
        <p className="text-xs font-semibold text-text-secondary">Connecting to ESP32-CAM Module Vision Receiver...</p>
      </div>
    );
  }

  const { disease, growth } = latestFrame;
  const isHealthy = disease.severity === 'Healthy';

  return (
    <div id="esp32-cam-panel" className="space-y-6 text-left select-none">
      
      {/* Module Title Header Banner */}
      <div className="bg-card-bg rounded-[24px] p-4 sm:p-5 shadow-glass border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
            <Cpu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ESP32-CAM ONLINE
              </span>
              <span className="text-[10px] font-mono text-text-secondary">IP: {latestFrame.ipAddress}</span>
              <span className="text-[10px] font-mono text-text-secondary">RSSI: {latestFrame.rssi} dBm</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-text-primary mt-0.5">ESP32-CAM Real-Time Vision & Growth Analyzer</h2>
            <p className="text-xs text-text-secondary">
              Captures live plant photos, analyzes diseases using Gemini Vision, and measures plant height automatically.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowArduinoCodeModal(true)}
            className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 bg-inner-bg hover:bg-white text-text-primary border border-divider/30 rounded-xl text-xs font-semibold font-mono flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[36px]"
          >
            <Code className="w-3.5 h-3.5 text-navy-active" />
            <span>ESP32 C++ Code</span>
          </button>

          <button
            onClick={triggerCapture}
            disabled={isLoading}
            className="flex-1 sm:flex-none px-4 py-2 sm:py-1.5 bg-navy-active hover:bg-navy-active/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 min-h-[36px]"
          >
            <Camera className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Scanning...' : 'Snap Frame Now'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-divider/30 gap-2 font-semibold text-xs text-text-secondary overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveTab('feed')}
          className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 transition-all shrink-0 whitespace-nowrap min-h-[36px] ${
            activeTab === 'feed' ? 'border-navy-active text-navy-active font-bold' : 'border-transparent hover:text-text-primary'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Live Frame Feed</span>
        </button>
        <button
          onClick={() => setActiveTab('growth')}
          className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 transition-all shrink-0 whitespace-nowrap min-h-[36px] ${
            activeTab === 'growth' ? 'border-navy-active text-navy-active font-bold' : 'border-transparent hover:text-text-primary'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>Growth & Height ({growth.plantHeightCm}cm)</span>
        </button>
        <button
          onClick={() => setActiveTab('disease')}
          className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 transition-all shrink-0 whitespace-nowrap min-h-[36px] ${
            activeTab === 'disease' ? 'border-navy-active text-navy-active font-bold' : 'border-transparent hover:text-text-primary'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Disease Diagnosis ({disease.severity})</span>
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 transition-all shrink-0 whitespace-nowrap min-h-[36px] ${
            activeTab === 'code' ? 'border-navy-active text-navy-active font-bold' : 'border-transparent hover:text-text-primary'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>Arduino C++ Flash Code</span>
        </button>
      </div>

      {/* Main View Area */}
      {activeTab === 'feed' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main ESP32-CAM Viewport Frame (8 Cols) */}
          <div className="lg:col-span-8 bg-black rounded-[28px] overflow-hidden shadow-2xl relative border border-white/10 flex flex-col justify-between min-h-[420px]">
            
            {/* Top Frame Overlay info */}
            <div className="p-3 sm:p-4 bg-gradient-to-b from-black/90 to-transparent flex flex-wrap items-center justify-between gap-2 z-10 text-white">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-mono font-bold tracking-wider uppercase">ESP32-CAM STREAM</span>
                <span className="text-[10px] font-mono text-white/70 bg-white/10 px-2 py-0.5 rounded-md hidden xs:inline-block">
                  UXGA 1600x1200
                </span>
              </div>
              <div className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                HEIGHT: {growth.plantHeightCm} cm
              </div>
            </div>

            {/* Frame Image / Webcam Canvas */}
            <div className="relative flex-1 flex items-center justify-center p-2 bg-slate-950">
              {isCapturingWebcam ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
                  <video ref={videoRef} autoPlay playsInline className="w-full max-h-[360px] object-contain rounded-2xl border border-emerald-500/40" />
                  <div className="absolute bottom-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={captureWebcamFrame}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capture Frame</span>
                    </button>
                    <button
                      onClick={stopWebcam}
                      className="px-4 py-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <VideoOff className="w-4 h-4" />
                      <span>Stop Webcam</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full min-h-[280px] max-h-[380px] flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900 group">
                  {imageError || !latestFrame.imageUrl ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                        <Camera className="w-6 h-6 animate-pulse" />
                      </div>
                      <span className="text-xs font-mono text-slate-300 font-bold">
                        ESP32-CAM Standby
                      </span>
                      <span className="text-[10px] text-slate-500 max-w-[200px]">
                        Click "Snap Frame Now" or "Upload" to analyze plant image
                      </span>
                    </div>
                  ) : (
                    <img
                      src={latestFrame.imageUrl}
                      alt=""
                      onError={() => setImageError(true)}
                      className="w-full h-full object-contain max-h-[380px] rounded-2xl"
                    />
                  )}
                  
                  {/* Visual Bounding Scale Overlay */}
                  <div className="absolute left-2.5 top-2.5 bottom-2.5 border-l-2 border-dashed border-sky-400 flex flex-col justify-between text-[8px] sm:text-[9px] font-mono text-sky-300 font-bold pl-1.5 bg-slate-950/80 backdrop-blur-xs py-1.5 rounded-r-md z-10 pointer-events-none">
                    <span>{growth.plantHeightCm}cm</span>
                    <span>15cm</span>
                    <span>0cm</span>
                  </div>

                  {/* AI Diagnosis Tag Badge Overlay - Positioned at Bottom Right to prevent top bar overlap */}
                  <div className="absolute right-2.5 bottom-2.5 bg-slate-950/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 text-left space-y-0.5 shadow-2xl z-20 pointer-events-none max-w-[180px] sm:max-w-none">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider whitespace-nowrap">
                        Gemini Vision AI
                      </span>
                    </div>
                    <span className={`text-[11px] sm:text-xs font-bold block truncate ${isHealthy ? 'text-emerald-300' : 'text-amber-400'}`}>
                      {disease.diseaseName}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-mono text-white/70 block whitespace-nowrap">
                      Confidence: {disease.confidence}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="p-3 sm:p-4 bg-slate-900/90 backdrop-blur-md border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-white">
              <div className="flex items-center justify-between sm:justify-start gap-2 text-xs font-mono">
                <span className="text-white/60">Auto-Snap:</span>
                <select
                  value={autoRefreshInterval}
                  onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                  className="bg-slate-800 border border-white/20 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value={0}>Disabled</option>
                  <option value={10}>Every 10 Seconds</option>
                  <option value={30}>Every 30 Seconds</option>
                  <option value={60}>Every 1 Minute</option>
                  <option value={300}>Every 5 Minutes</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-stretch sm:justify-end">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-white/10 flex items-center justify-center gap-1.5 transition-colors min-h-[36px]"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  <span>Upload</span>
                </button>

                {/* Webcam Toggle / Disable Control */}
                {isCapturingWebcam ? (
                  <button
                    onClick={stopWebcam}
                    className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold border border-rose-500/30 flex items-center justify-center gap-1.5 transition-colors shadow-sm min-h-[36px]"
                  >
                    <VideoOff className="w-3.5 h-3.5 text-white" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (isWebcamDisabled) {
                        setIsWebcamDisabled(false);
                      } else {
                        startWebcam();
                      }
                    }}
                    className={`flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors min-h-[36px] ${
                      isWebcamDisabled
                        ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border-white/10'
                    }`}
                  >
                    {isWebcamDisabled ? (
                      <>
                        <VideoOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Enable Webcam</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Webcam</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    if (isCapturingWebcam) {
                      stopWebcam();
                    }
                    setIsWebcamDisabled(!isWebcamDisabled);
                  }}
                  className={`px-2.5 py-2 sm:py-1.5 rounded-xl text-[11px] font-mono border flex items-center justify-center gap-1 transition-colors min-h-[36px] ${
                    isWebcamDisabled
                      ? 'bg-rose-950/80 text-rose-300 border-rose-500/40 hover:bg-rose-900/80'
                      : 'bg-slate-800/80 text-emerald-300 border-emerald-500/30 hover:bg-slate-700'
                  }`}
                  title={isWebcamDisabled ? 'Click to Enable Webcam' : 'Click to Disable Webcam'}
                >
                  {isWebcamDisabled ? (
                    <>
                      <VideoOff className="w-3 h-3 text-rose-400" />
                      <span>Disabled</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 text-emerald-400" />
                      <span>Disable Webcam</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Telemetry Cards Side Panel (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Plant Growth Height Gauge */}
            <div className="bg-card-bg rounded-[24px] p-5 shadow-glass border border-white/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-navy-active" />
                  Measured Plant Height
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  +{growth.heightGrowthRate} cm/day
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-3xl font-extrabold text-text-primary font-mono">
                  {growth.plantHeightCm} <span className="text-sm font-semibold text-text-secondary">cm</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-text-secondary font-bold uppercase block">Stage</span>
                  <span className="text-xs font-extrabold text-navy-active">{growth.growthStage}</span>
                </div>
              </div>

              {/* Progress visual bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] font-mono text-text-secondary">
                  <span>Height Maturity (0-40cm)</span>
                  <span>{Math.round((growth.plantHeightCm / 40) * 100)}%</span>
                </div>
                <div className="w-full bg-inner-bg rounded-full h-2.5 overflow-hidden border border-divider/20">
                  <div
                    className="bg-navy-active h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (growth.plantHeightCm / 40) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono">
                <div className="bg-inner-bg p-2 rounded-xl border border-divider/20">
                  <span className="text-[9px] text-text-secondary uppercase block font-sans font-bold">Stem Diameter</span>
                  <span className="font-extrabold text-text-primary">{growth.stemDiameterMm} mm</span>
                </div>
                <div className="bg-inner-bg p-2 rounded-xl border border-divider/20">
                  <span className="text-[9px] text-text-secondary uppercase block font-sans font-bold">Foliage Leaves</span>
                  <span className="font-extrabold text-text-primary">{growth.leafCount} leaves</span>
                </div>
              </div>
            </div>

            {/* Disease Identification Summary Card */}
            <div className="bg-card-bg rounded-[24px] p-5 shadow-glass border border-white/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-navy-active" />
                  Disease Scan Result
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isHealthy ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200'
                }`}>
                  {disease.severity}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-text-primary">{disease.diseaseName}</h4>
                <p className="text-[11px] text-text-secondary mt-0.5 font-mono">
                  Gemini AI Confidence: {disease.confidence}%
                </p>
              </div>

              {/* Treatment Quick Guide */}
              <div className="bg-inner-bg/80 p-3 rounded-2xl space-y-1.5 text-xs border border-divider/20">
                <span className="text-[10px] text-navy-active font-extrabold uppercase tracking-wider block font-mono">
                  Recommended Intervention
                </span>
                <ul className="space-y-1 text-text-primary text-[11px] list-disc list-inside">
                  {disease.treatment.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Growth Analysis Tab */}
      {activeTab === 'growth' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-card-bg p-4 sm:p-5 rounded-[24px] shadow-glass border border-white/20 space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase font-mono block">Plant Height</span>
              <span className="text-xl sm:text-2xl font-extrabold text-text-primary font-mono">{growth.plantHeightCm} cm</span>
              <span className="text-[10px] text-emerald-600 font-bold block">+{growth.heightGrowthRate} cm daily</span>
            </div>
            <div className="bg-card-bg p-4 sm:p-5 rounded-[24px] shadow-glass border border-white/20 space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase font-mono block">Stem Diameter</span>
              <span className="text-xl sm:text-2xl font-extrabold text-text-primary font-mono">{growth.stemDiameterMm} mm</span>
              <span className="text-[10px] text-text-secondary block">Sturdy stem</span>
            </div>
            <div className="bg-card-bg p-4 sm:p-5 rounded-[24px] shadow-glass border border-white/20 space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase font-mono block">Leaf Count</span>
              <span className="text-xl sm:text-2xl font-extrabold text-text-primary font-mono">{growth.leafCount} leaves</span>
              <span className="text-[10px] text-text-secondary block">Active foliage</span>
            </div>
            <div className="bg-card-bg p-4 sm:p-5 rounded-[24px] shadow-glass border border-white/20 space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase font-mono block">Days to Harvest</span>
              <span className="text-xl sm:text-2xl font-extrabold text-navy-active font-mono">{growth.estDaysToHarvest} days</span>
              <span className="text-[10px] text-text-secondary block">Est. MICH 2</span>
            </div>
          </div>

          {/* Historical Height Growth Line Table */}
          <div className="bg-card-bg rounded-[28px] p-4 sm:p-6 shadow-glass border border-white/20 space-y-4">
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase font-mono tracking-wider block">TIMELINE TRACKER</span>
              <h3 className="text-base font-bold text-text-primary">Historical ESP32-CAM Height Measurements</h3>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[550px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-divider/40 text-[10px] uppercase text-text-secondary font-mono">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Measured Height</th>
                    <th className="py-2.5 px-3">Leaves</th>
                    <th className="py-2.5 px-3">Health Score</th>
                    <th className="py-2.5 px-3">Disease Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider/20 font-mono">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-inner-bg/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-text-primary">{item.timestamp}</td>
                      <td className="py-3 px-3 uppercase text-[10px] font-bold text-navy-active">{item.source}</td>
                      <td className="py-3 px-3 font-bold text-text-primary">{item.growth.plantHeightCm} cm</td>
                      <td className="py-3 px-3">{item.growth.leafCount}</td>
                      <td className="py-3 px-3 font-bold text-emerald-600">{item.growth.healthScore} / 100</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                          item.disease.severity === 'Healthy' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {item.disease.diseaseName}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Disease Diagnosis Tab */}
      {activeTab === 'disease' && (
        <div className="bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 space-y-6">
          <div className="flex items-center justify-between border-b border-divider/30 pb-4">
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase font-mono tracking-wider block">PATHOLOGICAL REPORT</span>
              <h3 className="text-lg font-bold text-text-primary">{disease.diseaseName}</h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isHealthy ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {disease.severity} ({disease.confidence}% Confidence)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase font-mono text-navy-active">Symptoms Identified</h4>
              <ul className="space-y-2 text-xs text-text-primary">
                {disease.symptoms.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-inner-bg p-3 rounded-xl border border-divider/20">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase font-mono text-emerald-700">Treatment Protocol</h4>
              <ul className="space-y-2 text-xs text-text-primary">
                {disease.treatment.map((t, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Arduino Code Tab */}
      {activeTab === 'code' && (
        <div className="bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase font-mono tracking-wider block">HARDWARE SETUP</span>
              <h3 className="text-base font-bold text-text-primary">ESP32-CAM Arduino C++ Upload Firmware</h3>
            </div>
            <button
              onClick={copyCodeToClipboard}
              className="px-4 py-2 bg-navy-active text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-navy-active/90 transition-all shadow-2xs"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Code Copied!' : 'Copy Sketch'}</span>
            </button>
          </div>

          <p className="text-xs text-text-secondary">
            Flash this sketch to your ESP32-CAM (AI Thinker module) via Arduino IDE. Replace <code className="text-navy-active font-mono font-bold">YOUR_WIFI_SSID</code> and <code className="text-navy-active font-mono font-bold">YOUR_SERVER_IP</code> with your network details.
          </p>

          <pre className="bg-slate-950 text-emerald-400 p-4 rounded-2xl text-xs font-mono overflow-x-auto max-h-[400px] border border-white/10 shadow-inner">
            {arduinoCode || '// Loading C++ ESP32-CAM code...'}
          </pre>
        </div>
      )}

      {/* Modal Popup for Arduino Code */}
      {showArduinoCodeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-divider/20 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between border-b border-divider/30 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-navy-active" />
                <h3 className="text-base font-bold text-text-primary">ESP32-CAM Firmware Code</h3>
              </div>
              <button
                onClick={() => setShowArduinoCodeModal(false)}
                className="w-8 h-8 rounded-full bg-inner-bg hover:bg-divider/30 flex items-center justify-center text-text-primary"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-secondary">
              Copy this C++ sketch into Arduino IDE. Make sure to select <strong className="text-text-primary">AI Thinker ESP32-CAM</strong> as the board target and set PSRAM enabled.
            </p>

            <div className="relative">
              <button
                onClick={copyCodeToClipboard}
                className="absolute top-3 right-3 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 backdrop-blur-md border border-white/20"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>

              <pre className="bg-slate-950 text-emerald-400 p-4 rounded-2xl text-xs font-mono overflow-x-auto max-h-[350px] border border-white/10">
                {arduinoCode || '// Loading code...'}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowArduinoCodeModal(false)}
                className="px-5 py-2 bg-navy-active text-white rounded-xl text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
