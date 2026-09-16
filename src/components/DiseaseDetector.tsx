import React, { useState, useEffect, useRef } from 'react';
import { Camera, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Eye, Upload, VideoOff, Clock, HelpCircle, WifiOff } from 'lucide-react';
import { ESP32CamFrame } from '../types';
import { formatCaptureTime, isCameraOnline, timeSinceCapture } from '../utils/cameraStatus';

interface DiseaseDetectorProps {
  onUpdatePlantHeight?: (heightCm: number) => void;
  onUpdateHealthScore?: (score: number) => void;
}

export default function DiseaseDetector({ onUpdatePlantHeight, onUpdateHealthScore }: DiseaseDetectorProps) {
  const [latestFrame, setLatestFrame] = useState<ESP32CamFrame | null>(null);
  const [history, setHistory] = useState<ESP32CamFrame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isCapturingWebcam, setIsCapturingWebcam] = useState(false);
  const [autoScanSeconds, setAutoScanSeconds] = useState<number>(0); // 0 = off
  const [imageError, setImageError] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pull the real latest ESP32-CAM/webcam/upload frame + capture history.
  // This is the same backend state ESP32CamFeed reads — there is only one
  // real camera pipeline, not a "dual cam" system.
  const fetchLatest = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/esp32cam/latest');
      if (res.ok) {
        const data = await res.json();
        setLatestFrame(data.frame);
        if (data.frame) {
          onUpdatePlantHeight?.(data.frame.growth.plantHeightCm);
          onUpdateHealthScore?.(data.frame.growth.healthScore);
        }
      }
      const histRes = await fetch('/api/esp32cam/history');
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.history || []);
      }
    } catch (err) {
      console.error('Error fetching disease diagnosis frame:', err);
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  // Always poll for real updates in the background (independent of the
  // opt-in Auto-Scan control below) so the diagnosis log and the camera's
  // online/offline status reflect what's actually happening -- new frames
  // land every ~60s from the ESP32-CAM, and "went offline" needs regular
  // re-checks too, not just a one-time fetch on mount.
  useEffect(() => {
    const timer = setInterval(() => {
      fetchLatest();
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  // Auto-Scan lets the user opt into a faster check interval on top of the
  // background poll above — it never fabricates a scan result.
  useEffect(() => {
    if (autoScanSeconds <= 0) return;
    const timer = setInterval(() => {
      fetchLatest();
    }, autoScanSeconds * 1000);
    return () => clearInterval(timer);
  }, [autoScanSeconds]);

  const postFrame = async (image: string, mimeType: string, source: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/esp32cam/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mimeType, source }),
      });
      if (res.ok) {
        const data = await res.json();
        setLatestFrame(data.frame);
        setHistory((prev) => [data.frame, ...prev.slice(0, 19)]);
        if (data.frame) {
          onUpdatePlantHeight?.(data.frame.growth.plantHeightCm);
          onUpdateHealthScore?.(data.frame.growth.healthScore);
        }
      }
    } catch (err) {
      console.error('Error uploading frame for disease analysis:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => postFrame(reader.result as string, file.type, 'esp32_cam');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startWebcam = async () => {
    try {
      setIsCapturingWebcam(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Webcam access error:', err);
      alert('Could not access the camera. Ensure camera permissions are allowed.');
      setIsCapturingWebcam(false);
    }
  };

  const stopWebcam = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCapturingWebcam(false);
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
      stopWebcam();
      postFrame(dataUrl, 'image/jpeg', 'webcam');
    }
  };

  const isHealthy = latestFrame?.disease.severity === 'Healthy';
  const isUnknown = latestFrame?.disease.severity === 'Unknown';

  return (
    <div className="space-y-6 text-left select-none">
      {/* Header */}
      <div className="bg-card-bg rounded-[24px] p-4 sm:p-5 shadow-glass border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-text-primary">Live AI Disease Detection</h2>
          <p className="text-xs text-text-secondary">
            Upload or capture a plant photo — Gemini Vision analyzes it for disease, pests, and health status. No sample data is shown.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-text-secondary">Auto-Scan:</span>
          <select
            value={autoScanSeconds}
            onChange={(e) => setAutoScanSeconds(Number(e.target.value))}
            className="bg-inner-bg border border-divider/30 rounded-lg px-2 py-1 text-xs text-text-primary font-mono focus:outline-none"
          >
            <option value={0}>Disabled</option>
            <option value={30}>Check every 30s</option>
            <option value={60}>Check every 1 min</option>
            <option value={300}>Check every 5 min</option>
          </select>
        </div>
      </div>

      {/* No camera / no frame yet */}
      {!latestFrame && !isCapturingWebcam && (
        <div className="bg-card-bg rounded-[28px] p-8 text-center space-y-5 border border-divider/20 shadow-glass">
          {isLoading && !hasLoadedOnce ? (
            <>
              <RefreshCw className="w-8 h-8 text-navy-active animate-spin mx-auto" />
              <p className="text-xs font-semibold text-text-secondary">Checking for a camera frame...</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                <Camera className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-text-primary">No camera connected</p>
                <p className="text-xs text-text-secondary max-w-sm mx-auto">
                  No plant photo has been received yet, so there's nothing to diagnose. Upload a photo or use a webcam to run a real AI scan.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="px-4 py-2 bg-navy-active hover:bg-navy-active/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload a Photo</span>
                </button>
                <button
                  onClick={startWebcam}
                  className="px-4 py-2 bg-inner-bg hover:bg-white text-text-primary border border-divider/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Use Webcam</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Webcam live view (available whether or not a frame exists yet) */}
      {isCapturingWebcam && (
        <div className="bg-black rounded-[24px] p-4 flex flex-col items-center gap-3">
          <video ref={videoRef} autoPlay playsInline className="w-full max-w-md rounded-2xl border border-emerald-500/40" />
          <div className="flex items-center gap-2">
            <button
              onClick={captureWebcamFrame}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Capture &amp; Analyze</span>
            </button>
            <button
              onClick={stopWebcam}
              className="px-4 py-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all active:scale-95"
            >
              <VideoOff className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Real diagnosis result */}
      {latestFrame && !isCapturingWebcam && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-black rounded-[28px] overflow-hidden shadow-2xl border border-white/10 relative min-h-[280px] flex items-center justify-center">
            {imageError || !latestFrame.imageUrl ? (
              <div className="text-center p-6 space-y-2">
                <Camera className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">Image unavailable</p>
              </div>
            ) : (
              <img
                src={latestFrame.imageUrl}
                alt="Latest captured plant frame"
                onError={() => setImageError(true)}
                className="w-full h-full object-contain max-h-[380px]"
              />
            )}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 text-[10px] font-mono text-white/80">
              <div className="flex items-center gap-1.5">
                <span className="bg-black/60 px-2 py-1 rounded-md">
                  {latestFrame.source === 'esp32_cam' ? 'ESP32-CAM' : latestFrame.source === 'webcam' ? 'WEBCAM' : 'UPLOADED'}
                </span>
                {latestFrame.source === 'esp32_cam' && !isCameraOnline(latestFrame) && (
                  <span className="bg-rose-600/80 px-2 py-1 rounded-md flex items-center gap-1 text-white">
                    <WifiOff className="w-3 h-3" />
                    Offline &middot; last seen {timeSinceCapture(latestFrame)}
                  </span>
                )}
              </div>
              <span className="bg-black/60 px-2 py-1 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatCaptureTime(latestFrame)}
              </span>
            </div>
          </div>

          <div className="lg:col-span-7 bg-card-bg rounded-[28px] p-5 sm:p-6 shadow-glass border border-white/20 space-y-4">
            <div className="flex items-center justify-between border-b border-divider/30 pb-3">
              <div>
                <span className="text-[10px] text-text-secondary font-bold uppercase font-mono tracking-wider block">AI Diagnosis</span>
                <h3 className="text-lg font-bold text-text-primary">{latestFrame.disease.diseaseName}</h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  isHealthy
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isUnknown
                    ? 'bg-slate-100 text-slate-600 border-slate-300'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {isHealthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : isUnknown ? <HelpCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {latestFrame.disease.severity} {latestFrame.disease.confidence > 0 && `(${latestFrame.disease.confidence}% confidence)`}
              </span>
            </div>

            {latestFrame.analysisAvailable === false && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3">
                AI analysis is unavailable for this photo
                {latestFrame.disease.symptoms[0] ? ` — ${latestFrame.disease.symptoms[0]}` : ''}. The image was still saved.
              </div>
            )}

            {latestFrame.disease.symptoms.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase font-mono text-navy-active">Symptoms Identified</h4>
                <ul className="space-y-1.5 text-xs text-text-primary">
                  {latestFrame.disease.symptoms.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-inner-bg p-2.5 rounded-xl border border-divider/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {latestFrame.disease.treatment.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase font-mono text-emerald-700">Recommended Treatment</h4>
                <ul className="space-y-1.5 text-xs text-text-primary">
                  {latestFrame.disease.treatment.map((t, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-divider/20">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="px-3.5 py-2 bg-navy-active hover:bg-navy-active/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Analyzing...' : 'New Photo'}</span>
              </button>
              <button
                onClick={startWebcam}
                className="px-3.5 py-2 bg-inner-bg hover:bg-white text-text-primary border border-divider/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>Webcam</span>
              </button>
              <button
                onClick={fetchLatest}
                disabled={isLoading}
                className="px-3.5 py-2 bg-inner-bg hover:bg-white text-text-primary border border-divider/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real capture history */}
      {history.length > 0 && (
        <div className="bg-card-bg rounded-[28px] p-4 sm:p-6 shadow-glass border border-white/20 space-y-4">
          <div>
            <span className="text-[10px] text-text-secondary font-bold uppercase font-mono tracking-wider block">DIAGNOSIS LOG</span>
            <h3 className="text-base font-bold text-text-primary">Capture &amp; Diagnosis History</h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[520px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-divider/40 text-[10px] uppercase text-text-secondary font-mono">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Diagnosis</th>
                  <th className="py-2.5 px-3">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider/20 font-mono">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-inner-bg/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-text-primary">{formatCaptureTime(item)}</td>
                    <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-navy-active">{item.source}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                          item.disease.severity === 'Healthy'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.disease.severity === 'Unknown'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {item.disease.diseaseName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{item.disease.confidence > 0 ? `${item.disease.confidence}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
