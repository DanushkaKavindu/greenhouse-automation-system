import { Sliders, Sun, Thermometer, Droplets, Lightbulb, Activity, Sparkles, Heart, AlertTriangle, ArrowRight, ShieldCheck, Sprout, Camera, Edit3, Check, RefreshCw, Calendar, BarChart2, FlaskConical, Leaf, Zap } from 'lucide-react';
import { useState, ChangeEvent } from 'react';
import { SensorData, ControlData, PageId, CropVariety } from '../types';
import { useDailyAverages } from '../utils/telemetry';

interface DashboardProps {
  sensorData: SensorData;
  controlData: ControlData;
  onUpdateControl: (field: keyof ControlData, value: boolean) => void;
  onPageChange: (page: PageId) => void;
  currentCrop: CropVariety;
  cropPresets: CropVariety[];
  onUpdateCrop: (crop: CropVariety) => void;
  plantingDate: string;
  onUpdatePlantingDate: (date: string) => void;
  onUpdateGrowthStage: (stage: 'Seedling' | 'Vegetative' | 'Flowering' | 'Fruiting') => void;
  aiHarvestDays: number | null;
  onUpdateAIHarvestDays: (days: number | null) => void;
  onUpdateHealthScore: (score: number) => void;
  selectedCalendarDate?: string;
  onUpdateSelectedCalendarDate?: (date: string) => void;
  onOpenHardwareModal?: () => void;
  isHardwareConnected?: boolean;
  lastHeartbeat?: string | null;
}

export default function Dashboard({ 
  sensorData, 
  controlData, 
  onUpdateControl, 
  onPageChange,
  currentCrop,
  cropPresets,
  onUpdateCrop,
  plantingDate,
  onUpdatePlantingDate,
  onUpdateGrowthStage,
  aiHarvestDays,
  onUpdateAIHarvestDays,
  onUpdateHealthScore,
  selectedCalendarDate,
  onUpdateSelectedCalendarDate,
  onOpenHardwareModal,
  isHardwareConnected,
  lastHeartbeat,
}: DashboardProps) {

  // Selected date daily telemetry averages — real data logged from actual
  // ESP32 readings, zero when nothing has been logged for that date yet.
  const activeSelectedDate = selectedCalendarDate || new Date().toISOString().split('T')[0];
  const { data: dailyAvgData } = useDailyAverages(activeSelectedDate);

  // Inline configuration toggles
  const [isEditingCrop, setIsEditingCrop] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [isAnalyzingCrop, setIsAnalyzingCrop] = useState(false);
  const [scanResult, setScanResult] = useState<{
    detectedCropType: string;
    growthStage: 'Seedling' | 'Vegetative' | 'Flowering' | 'Fruiting';
    confidence: number;
    healthScore: number;
    estDaysToHarvest: number;
    visualObservations: string;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Parse numeric timeline days
  const daysSincePlanted = Math.max(0, Math.floor((new Date().getTime() - new Date(plantingDate).getTime()) / (1000 * 60 * 60 * 24)));
  const harvestDaysRemaining = aiHarvestDays !== null 
    ? aiHarvestDays 
    : Math.max(1, currentCrop.standardDurationDays - daysSincePlanted);

  const handleScanImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setScanImage(reader.result as string);
        setScanError(null);
        setScanResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const runCropAnalysis = async () => {
    if (!scanImage) return;
    setIsAnalyzingCrop(true);
    setScanError(null);
    try {
      const base64Parts = scanImage.split(',');
      const base64Data = base64Parts[1];
      const mimeType = base64Parts[0].match(/data:(.*?);/)?.[1] || 'image/jpeg';

      const res = await fetch('/api/crop-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          mimeType,
          cropType: currentCrop.name,
        }),
      });

      if (!res.ok) {
        throw new Error('AI analysis failed. Please check network connection.');
      }

      const data = await res.json();
      setScanResult(data);
      
      // Feed values back into the main application state
      onUpdateGrowthStage(data.growthStage);
      onUpdateHealthScore(data.healthScore);
      onUpdateAIHarvestDays(data.estDaysToHarvest);
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || 'Analysis failed. Please check network connection.');
    } finally {
      setIsAnalyzingCrop(false);
    }
  };

  const resetScannerState = () => {
    setScanImage(null);
    setScanResult(null);
    setScanError(null);
    setIsScanning(false);
  };

  const variety = currentCrop;

  // Telemetry status calculations
  const tempStatus = (sensorData.temperature >= 25 && sensorData.temperature <= 32) ? 'optimal' : 'warning';
  const humStatus = (sensorData.humidity >= 55 && sensorData.humidity <= 75) ? 'optimal' : 'warning';
  const soilStatus = (sensorData.soilMoisture >= 40 && sensorData.soilMoisture <= 70) ? 'optimal' : 'warning';
  const lightStatus = (sensorData.lightIntensity >= 300 && sensorData.lightIntensity <= 1000) ? 'optimal' : 'warning';

  // NPK Soil Nutrients Status (RS485 Sensor) — 0 until real hardware reports a value
  const nVal = sensorData.nitrogen ?? 0;
  const pVal = sensorData.phosphorus ?? 0;
  const kVal = sensorData.potassium ?? 0;

  const nStatus = (nVal >= 130 && nVal <= 210) ? 'optimal' : (nVal < 130 ? 'low' : 'high');
  const pStatus = (pVal >= 30 && pVal <= 65) ? 'optimal' : (pVal < 30 ? 'low' : 'high');
  const kStatus = (kVal >= 150 && kVal <= 260) ? 'optimal' : (kVal < 150 ? 'low' : 'high');
  const npkAllOptimal = nStatus === 'optimal' && pStatus === 'optimal' && kStatus === 'optimal';

  return (
    <div id="dashboard-container" className="space-y-6 select-none text-left max-w-full overflow-hidden">
      
      {/* Top Banner Control Header */}
      <div className="bg-card-bg rounded-[24px] p-6 shadow-glass border border-white/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-emerald-50 text-status-healthy font-extrabold uppercase tracking-widest py-1 px-3 rounded-full border border-emerald-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-healthy animate-pulse" />
              LK-MICH-Node 01
            </span>
            <span className="text-[10px] bg-navy-active text-white font-semibold py-1 px-3 rounded-full uppercase tracking-wider">
              {sensorData.growthStage} Stage
            </span>
            <span className={`text-[10px] font-bold py-1 px-2.5 rounded-full border uppercase tracking-wider hidden sm:inline-flex items-center gap-1 ${
              isHardwareConnected
                ? 'bg-purple-50 text-purple-700 border-purple-200/60'
                : 'bg-amber-50 text-amber-700 border-amber-200/60'
            }`}>
              <FlaskConical className="w-3 h-3" />
              {isHardwareConnected ? 'NPK Sensor Online' : 'No Sensor Connected'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mt-2">
            Green House Automation System
          </h1>
          <p className="text-xs text-text-secondary">
            {isHardwareConnected
              ? `Synchronized with ESP32 node · Last reading received ${sensorData.timestamp}`
              : 'No ESP32 hardware connected · showing zero until a device reports data'}
          </p>
        </div>

        {/* Action Buttons: Hardware Connection & Global Auto/Manual Toggle Switch */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Hardware Connection Guide & Status Button */}
          <button
            onClick={onOpenHardwareModal}
            className={`p-2.5 px-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all shadow-xs ${
              isHardwareConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-inner-bg text-text-primary border-divider/30 hover:border-navy-active/50'
            }`}
            title="Connect ESP32 Hardware or View Firmware Code"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${
              isHardwareConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'
            }`} />
            <span className="hidden sm:inline">
              {isHardwareConnected ? 'ESP32 Live Stream' : 'Connect Real Hardware'}
            </span>
            <span className="sm:hidden">Hardware</span>
          </button>

          {/* Global Auto/Manual Toggle Switch */}
          <div className="flex items-center gap-3 bg-inner-bg p-2 rounded-2xl border border-divider/20 shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider block">Greenhouse Mode</span>
              <span className={`text-xs font-semibold ${controlData.autoMode ? 'text-status-healthy' : 'text-text-primary'}`}>
                {controlData.autoMode ? '⚡ Automated Care' : '🛠️ Manual Override'}
              </span>
            </div>

            <button
              onClick={() => onUpdateControl('autoMode', !controlData.autoMode)}
              className={`w-14 h-8 rounded-full transition-all relative ${
                controlData.autoMode ? 'bg-navy-active' : 'bg-divider'
              }`}
            >
              <div className={`w-6 h-6 rounded-full bg-white absolute top-1 transition-all shadow-sm ${
                controlData.autoMode ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Selected Date Daily Average Values Section */}
      <div className="bg-card-bg rounded-[24px] p-5 shadow-glass border border-white/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-divider/20 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-navy-active/10 flex items-center justify-center text-navy-active shrink-0 border border-navy-active/15">
              <BarChart2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block font-mono">
                CALENDAR SELECTED DATE DAILY AVERAGES
              </span>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                Daily Telemetry Averages for <span className="text-navy-active font-mono font-extrabold underline decoration-navy-active/30">{activeSelectedDate}</span>
              </h3>
            </div>
          </div>

          {dailyAvgData.sampleCount === 0 && (
            <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 uppercase tracking-wider self-start sm:self-auto">
              No readings logged for this date yet
            </span>
          )}
          
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[10px] text-text-secondary font-mono font-bold uppercase hidden md:inline">Calendar Date:</span>
            <input
              type="date"
              value={activeSelectedDate}
              onChange={(e) => onUpdateSelectedCalendarDate && onUpdateSelectedCalendarDate(e.target.value)}
              className="bg-inner-bg hover:bg-white border border-divider/40 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-navy-active shadow-2xs transition-colors cursor-pointer"
            />
            <button
              onClick={() => onPageChange('calendar')}
              className="py-1.5 px-3 bg-navy-active hover:bg-navy-active/90 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
              title="Open Google Calendar View"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
        </div>

        {/* 7 Daily Average Metrics: 4 Environmental + 3 NPK Soil Nutrients */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div className="bg-inner-bg/60 p-3 rounded-2xl border border-divider/20 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-text-secondary font-bold uppercase font-mono flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-rose-400" />
                Air Temp
              </span>
              <span className="text-[8px] text-status-healthy font-semibold bg-green-50 px-1 py-0.2 rounded-full border border-green-100">Opt</span>
            </div>
            <div className="flex items-baseline gap-0.5 pt-0.5">
              <span className="text-lg font-bold text-text-primary">{dailyAvgData.temp}</span>
            </div>
          </div>

          <div className="bg-inner-bg/60 p-3 rounded-2xl border border-divider/20 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-text-secondary font-bold uppercase font-mono flex items-center gap-1">
                <Droplets className="w-3 h-3 text-sky-400" />
                Humidity
              </span>
              <span className="text-[8px] text-status-healthy font-semibold bg-green-50 px-1 py-0.2 rounded-full border border-green-100">Opt</span>
            </div>
            <div className="flex items-baseline gap-0.5 pt-0.5">
              <span className="text-lg font-bold text-text-primary">{dailyAvgData.humidity}</span>
            </div>
          </div>

          <div className="bg-inner-bg/60 p-3 rounded-2xl border border-divider/20 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-text-secondary font-bold uppercase font-mono flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                Moisture
              </span>
              <span className="text-[8px] text-status-healthy font-semibold bg-green-50 px-1 py-0.2 rounded-full border border-green-100">Opt</span>
            </div>
            <div className="flex items-baseline gap-0.5 pt-0.5">
              <span className="text-lg font-bold text-text-primary">{dailyAvgData.soil}</span>
            </div>
          </div>

          <div className="bg-inner-bg/60 p-3 rounded-2xl border border-divider/20 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-text-secondary font-bold uppercase font-mono flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-amber-400" />
                Solar Lux
              </span>
              <span className="text-[8px] text-status-healthy font-semibold bg-green-50 px-1 py-0.2 rounded-full border border-green-100">Opt</span>
            </div>
            <div className="flex items-baseline gap-0.5 pt-0.5">
              <span className="text-lg font-bold text-amber-600">{dailyAvgData.light}</span>
            </div>
          </div>

          <div className="bg-purple-50/60 p-3 rounded-2xl border border-purple-100 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-purple-700 font-bold uppercase font-mono flex items-center gap-1">
                <span className="font-extrabold text-[10px]">N</span>itrogen
              </span>
              <span className="text-[8px] text-purple-700 font-bold bg-purple-100 px-1 py-0.2 rounded-full">Soil</span>
            </div>
            <div className="flex items-baseline gap-0.5 pt-0.5">
              <span className="text-lg font-bold text-purple-900">{dailyAvgData.nitrogen}</span>
            </div>
          </div>

          <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-indigo-700 font-bold uppercase font-mono flex items-center gap-1">
                <span className="font-extrabold text-[10px]">P</span>hosphorus
              </span>
              <span className="text-[8px] text-indigo-700 font-bold bg-indigo-100 px-1 py-0.2 rounded-full">Soil</span>
            </div>
            <div className="flex items-baseline gap-0.5 pt-0.5">
              <span className="text-lg font-bold text-indigo-900">{dailyAvgData.phosphorus}</span>
            </div>
          </div>

          <div className="bg-teal-50/60 p-3 rounded-2xl border border-teal-100 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-teal-700 font-bold uppercase font-mono flex items-center gap-1">
                <span className="font-extrabold text-[10px]">K</span> (Potash)
              </span>
              <span className="text-[8px] text-teal-700 font-bold bg-teal-100 px-1 py-0.2 rounded-full">Soil</span>
            </div>
            <div className="flex items-baseline gap-0.5 pt-0.5">
              <span className="text-lg font-bold text-teal-900">{dailyAvgData.potassium}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Visual Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Column 1: Live Telemetries & NPK Soil Nutrients (4 cols) */}
        <div className="lg:col-span-4 bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block font-mono">LIVE SENSOR TELEMETRY</span>
              <span className="text-[9px] bg-emerald-50 text-status-healthy font-extrabold px-2 py-0.5 rounded-full border border-emerald-100 font-mono">
                5 SENSORS ACTIVE
              </span>
            </div>

            {/* Microclimate Cards */}
            <div className="space-y-3">
              
              {/* Temperature */}
              <div className="bg-inner-bg/40 rounded-2xl p-3 border border-white/30 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                    <Thermometer className="w-4 h-4 text-rose-400 stroke-[1.5]" />
                    Air Temperature
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    tempStatus === 'optimal' ? 'bg-green-50 text-status-healthy' : 'bg-red-50 text-status-critical'
                  }`}>
                    {tempStatus}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-text-primary">{sensorData.temperature}</span>
                  <span className="text-sm text-text-secondary">°C</span>
                </div>
                <div className="w-full h-1 bg-divider rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${tempStatus === 'optimal' ? 'bg-status-healthy' : 'bg-status-critical'}`} 
                    style={{ width: `${Math.min(100, (sensorData.temperature / 45) * 100)}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[9px] text-text-secondary">
                  <span>Min: 15°C</span>
                  <span>Optimal: {variety.optimalTemp}</span>
                  <span>Max: 45°C</span>
                </div>
              </div>

              {/* Humidity */}
              <div className="bg-inner-bg/40 rounded-2xl p-3 border border-white/30 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                    <Droplets className="w-4 h-4 text-sky-400 stroke-[1.5]" />
                    Air Humidity
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    humStatus === 'optimal' ? 'bg-green-50 text-status-healthy' : 'bg-amber-50 text-status-warning'
                  }`}>
                    {humStatus}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-text-primary">{sensorData.humidity}</span>
                  <span className="text-sm text-text-secondary">%</span>
                </div>
                <div className="w-full h-1 bg-divider rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${humStatus === 'optimal' ? 'bg-status-healthy' : 'bg-status-warning'}`} 
                    style={{ width: `${sensorData.humidity}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[9px] text-text-secondary">
                  <span>Min: 20%</span>
                  <span>Optimal: {variety.optimalHumidity}</span>
                  <span>Max: 90%</span>
                </div>
              </div>

              {/* Soil Moisture */}
              <div className="bg-inner-bg/40 rounded-2xl p-3 border border-white/30 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                    <Activity className="w-4 h-4 text-emerald-400 stroke-[1.5]" />
                    Soil Moisture
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    soilStatus === 'optimal' ? 'bg-green-50 text-status-healthy' : 'bg-amber-50 text-status-warning'
                  }`}>
                    {soilStatus}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-text-primary">{sensorData.soilMoisture}</span>
                  <span className="text-sm text-text-secondary">%</span>
                </div>
                <div className="w-full h-1 bg-divider rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${soilStatus === 'optimal' ? 'bg-status-healthy' : 'bg-status-warning'}`} 
                    style={{ width: `${sensorData.soilMoisture}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[9px] text-text-secondary">
                  <span>Min: 10%</span>
                  <span>Optimal: {variety.optimalSoil}</span>
                  <span>Max: 90%</span>
                </div>
              </div>

              {/* Light Intensity */}
              <div className="bg-inner-bg/40 rounded-2xl p-3 border border-white/30 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                    <Lightbulb className="w-4 h-4 text-amber-400 stroke-[1.5]" />
                    Light Intensity
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    lightStatus === 'optimal' ? 'bg-green-50 text-status-healthy' : 'bg-amber-50 text-status-warning'
                  }`}>
                    {lightStatus}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-text-primary">{sensorData.lightIntensity}</span>
                  <span className="text-sm text-text-secondary">lx</span>
                </div>
                <div className="w-full h-1 bg-divider rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${lightStatus === 'optimal' ? 'bg-status-healthy' : 'bg-status-warning'}`} 
                    style={{ width: `${Math.min(100, (sensorData.lightIntensity / 1200) * 100)}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[9px] text-text-secondary">
                  <span>Min: 50 lx</span>
                  <span>Optimal: {variety.optimalLight}</span>
                  <span>Max: 1200 lx</span>
                </div>
              </div>

              {/* DEDICATED NPK SOIL NUTRIENT SENSOR CARD (RS485 Modbus) */}
              <div className="bg-gradient-to-br from-purple-50/50 via-inner-bg/40 to-indigo-50/40 rounded-2xl p-3.5 border border-purple-200/50 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                      <FlaskConical className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-text-primary block">Soil NPK Nutrients</span>
                      <span className="text-[8px] text-text-secondary font-mono">RS485 Modbus Sensor Node</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    npkAllOptimal ? 'bg-green-50 text-status-healthy border border-green-100' : 'bg-purple-50 text-purple-700 border border-purple-100'
                  }`}>
                    {npkAllOptimal ? 'NPK Optimal' : 'Balanced'}
                  </span>
                </div>

                {/* Individual N, P, K Nutrient Bars */}
                <div className="space-y-2.5 pt-1">
                  
                  {/* Nitrogen (N) */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-purple-900 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        Nitrogen (N)
                      </span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-extrabold text-text-primary text-xs">{nVal}</span>
                        <span className="text-[9px] text-text-secondary">mg/kg</span>
                        <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase ${
                          nStatus === 'optimal' ? 'text-status-healthy bg-green-50' : 'text-amber-600 bg-amber-50'
                        }`}>
                          {nStatus}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-divider/60 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all" 
                        style={{ width: `${Math.min(100, (nVal / 250) * 100)}%` }} 
                      />
                    </div>
                    <div className="flex justify-between text-[8px] text-text-secondary font-mono">
                      <span>Min: 50</span>
                      <span>Target: {variety.optimalNPK?.n || '140-200 mg/kg'}</span>
                      <span>Max: 300</span>
                    </div>
                  </div>

                  {/* Phosphorus (P) */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-indigo-900 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Phosphorus (P)
                      </span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-extrabold text-text-primary text-xs">{pVal}</span>
                        <span className="text-[9px] text-text-secondary">mg/kg</span>
                        <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase ${
                          pStatus === 'optimal' ? 'text-status-healthy bg-green-50' : 'text-amber-600 bg-amber-50'
                        }`}>
                          {pStatus}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-divider/60 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all" 
                        style={{ width: `${Math.min(100, (pVal / 100) * 100)}%` }} 
                      />
                    </div>
                    <div className="flex justify-between text-[8px] text-text-secondary font-mono">
                      <span>Min: 15</span>
                      <span>Target: {variety.optimalNPK?.p || '35-60 mg/kg'}</span>
                      <span>Max: 100</span>
                    </div>
                  </div>

                  {/* Potassium (K) */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-teal-900 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        Potassium (K)
                      </span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-extrabold text-text-primary text-xs">{kVal}</span>
                        <span className="text-[9px] text-text-secondary">mg/kg</span>
                        <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase ${
                          kStatus === 'optimal' ? 'text-status-healthy bg-green-50' : 'text-amber-600 bg-amber-50'
                        }`}>
                          {kStatus}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-divider/60 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal-500 rounded-full transition-all" 
                        style={{ width: `${Math.min(100, (kVal / 350) * 100)}%` }} 
                      />
                    </div>
                    <div className="flex justify-between text-[8px] text-text-secondary font-mono">
                      <span>Min: 60</span>
                      <span>Target: {variety.optimalNPK?.k || '160-250 mg/kg'}</span>
                      <span>Max: 350</span>
                    </div>
                  </div>
                </div>

                {/* Live NPK Ratio and Soil Chemistry Insight */}
                <div className="bg-white/80 rounded-xl p-2.5 border border-purple-100/60 flex items-center justify-between text-[10px]">
                  <div>
                    <span className="text-[8px] text-text-secondary font-bold uppercase font-mono block">NPK Stoichiometric Ratio</span>
                    <span className="font-mono font-extrabold text-purple-900 text-xs">
                      {Math.round(nVal / 10)} : {Math.max(1, Math.round(pVal / 10))} : {Math.round(kVal / 10)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-text-secondary font-bold uppercase font-mono block">Soil Fertility</span>
                    <span className="font-bold text-status-healthy text-[11px] flex items-center gap-1 justify-end">
                      <Leaf className="w-3 h-3 text-status-healthy" /> High Yield
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </div>

          <div 
            onClick={() => onPageChange('reports')}
            className="group flex items-center justify-between p-3 bg-inner-bg hover:bg-divider rounded-xl cursor-pointer transition-colors"
          >
            <span className="text-xs font-semibold text-text-primary flex items-center gap-2">
              📊 Analytics & History Reports
            </span>
            <ArrowRight className="w-4 h-4 text-text-secondary group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Column 2: Crop Vitals details (5 cols) */}
        <div className="lg:col-span-5 bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block font-mono">CROP SUMMARY</span>
                <h3 className="text-lg font-semibold text-text-primary">Cultivation Vitals</h3>
              </div>
              <button 
                onClick={() => {
                  setIsEditingCrop(!isEditingCrop);
                  setIsScanning(false);
                }}
                className={`py-1.5 px-3.5 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  isEditingCrop 
                    ? 'bg-navy-active text-white shadow-sm'
                    : 'bg-inner-bg/60 border border-divider/10 text-text-primary hover:bg-inner-bg'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isEditingCrop ? 'View Vitals' : 'Configure Crop'}
              </button>
            </div>

            {isEditingCrop ? (
              <div className="bg-inner-bg/40 rounded-2xl p-4 border border-navy-active/20 space-y-3">
                <div className="flex items-center justify-between border-b border-divider/10 pb-2 mb-1">
                  <span className="text-[10px] font-extrabold text-navy-active uppercase tracking-wider">Configure Plant Profile</span>
                  <span className="text-[9px] text-text-secondary font-mono">Step 1 of 2</span>
                </div>
                
                {/* Crop select preset buttons */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-text-secondary uppercase tracking-wider font-mono">Select Preset Variety</label>
                  <div className="grid grid-cols-2 gap-2">
                    {cropPresets.map((preset) => {
                      const isSelected = currentCrop.name === preset.name;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            onUpdateCrop(preset);
                            onUpdateAIHarvestDays(null);
                          }}
                          className={`p-2 rounded-xl text-left border transition-all ${
                            isSelected
                              ? 'bg-navy-active text-white border-navy-active shadow-sm'
                              : 'bg-white border-divider hover:bg-inner-bg/50 text-text-primary'
                          }`}
                        >
                          <div className="font-bold truncate text-[11px]">{preset.name.split(' (')[0]}</div>
                          <div className={`text-[8px] truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-text-secondary'}`}>
                            {preset.standardDurationDays} Days Cycle
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCrop({
                          name: 'Custom Variety',
                          origin: 'Greenhouse Local',
                          optimalTemp: '24°C - 31°C',
                          optimalHumidity: '50% - 75%',
                          optimalSoil: '45% - 70%',
                          optimalLight: '300 lx - 900 lx',
                          optimalNPK: {
                            n: '130 - 200 mg/kg',
                            p: '30 - 60 mg/kg',
                            k: '150 - 250 mg/kg'
                          },
                          description: 'Custom greenhouse crop cultivar.',
                          standardDurationDays: 90
                        });
                        onUpdateAIHarvestDays(null);
                      }}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        !cropPresets.some(p => p.name === currentCrop.name)
                          ? 'bg-navy-active text-white border-navy-active shadow-sm'
                          : 'bg-white border-divider hover:bg-inner-bg/50 text-text-primary'
                      }`}
                    >
                      <div className="font-bold text-[11px]">✏️ Custom</div>
                      <div className={`text-[8px] mt-0.5 ${!cropPresets.some(p => p.name === currentCrop.name) ? 'text-white/80' : 'text-text-secondary'}`}>
                        Configure manually
                      </div>
                    </button>
                  </div>
                </div>

                {/* Custom Edit Inputs if selected custom variety */}
                {!cropPresets.some(p => p.name === currentCrop.name) && (
                  <div className="space-y-2 bg-white/60 p-3 rounded-xl border border-divider/10 mt-2">
                    <div>
                      <label className="text-[9px] font-bold text-text-secondary uppercase font-mono">Custom Crop Name</label>
                      <input 
                        type="text" 
                        value={currentCrop.name}
                        onChange={(e) => onUpdateCrop({ ...currentCrop, name: e.target.value })}
                        className="w-full bg-white border border-divider rounded-lg px-2.5 py-1.5 mt-1 focus:outline-none focus:border-navy-active text-text-primary text-xs"
                        placeholder="e.g. Sweet Basil"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-text-secondary uppercase font-mono">Origin / Breed</label>
                      <input 
                        type="text" 
                        value={currentCrop.origin}
                        onChange={(e) => onUpdateCrop({ ...currentCrop, origin: e.target.value })}
                        className="w-full bg-white border border-divider rounded-lg px-2.5 py-1.5 mt-1 focus:outline-none focus:border-navy-active text-text-primary text-xs"
                        placeholder="e.g. Local organic farm"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-text-secondary uppercase font-mono">Standard Life Cycle Duration (Days)</label>
                      <input 
                        type="number" 
                        value={currentCrop.standardDurationDays}
                        onChange={(e) => onUpdateCrop({ ...currentCrop, standardDurationDays: Number(e.target.value) || 90 })}
                        className="w-full bg-white border border-divider rounded-lg px-2.5 py-1.5 mt-1 focus:outline-none focus:border-navy-active text-text-primary text-xs"
                        placeholder="e.g. 90"
                      />
                    </div>
                  </div>
                )}

                {/* Planting Date Input */}
                <div className="space-y-1.5 pt-2 border-t border-divider/10 mt-2">
                  <label className="text-[9px] font-bold text-text-secondary uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-navy-active" />
                    Enter Planting Date
                  </label>
                  <input 
                    type="date"
                    value={plantingDate}
                    onChange={(e) => {
                      onUpdatePlantingDate(e.target.value);
                      onUpdateAIHarvestDays(null); // Reset AI override
                    }}
                    className="w-full bg-white border border-divider rounded-xl px-3 py-2 mt-1 focus:outline-none focus:border-navy-active text-text-primary text-xs font-mono"
                  />
                  <p className="text-[9px] text-text-secondary italic">
                    Modifying this dynamically adjusts your "Days Since Planted" logs.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingCrop(false)}
                  className="w-full py-2 bg-navy-active text-white font-bold rounded-xl text-xs hover:bg-navy-active/90 transition-all shadow-sm flex items-center justify-center gap-1.5 mt-2"
                >
                  <Check className="w-4 h-4" />
                  Apply Configuration
                </button>
              </div>
            ) : (
              /* Normal Variety Profile card */
              <div className="bg-inner-bg/30 rounded-2xl p-4 border border-white/40 space-y-3 relative group">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-status-healthy">
                    <Sprout className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">{currentCrop.name}</h4>
                    <span className="text-[9px] text-text-secondary font-medium block">Origin: {currentCrop.origin}</span>
                  </div>
                </div>
                <p className="text-[11px] text-text-primary leading-relaxed">
                  {currentCrop.description}
                </p>
                <div className="text-[9px] text-text-secondary font-semibold font-mono flex items-center gap-1.5 border-t border-divider/10 pt-2.5">
                  <span>⏱️ Harvest Cycle: {currentCrop.standardDurationDays} Days</span>
                  <span>|</span>
                  <span>Ideal: {currentCrop.optimalTemp}</span>
                </div>
              </div>
            )}

            {/* Growth Steps Indicator & Camera analysis trigger */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block font-mono">Lifecycle Timeline</span>
                
                <button
                  onClick={() => {
                    setIsScanning(!isScanning);
                    setIsEditingCrop(false);
                  }}
                  className={`py-1 px-2.5 rounded-lg text-[9px] font-bold tracking-wide uppercase transition-all flex items-center gap-1.5 ${
                    isScanning 
                      ? 'bg-rose-50 border border-rose-100 text-status-critical'
                      : 'bg-emerald-50 border border-emerald-100 text-status-healthy hover:bg-emerald-100/50'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isScanning ? 'Close Scanner' : 'Scan Timeline'}
                </button>
              </div>
              
              {/* Camera Scanner Dropper View */}
              {isScanning && (
                <div className="bg-inner-bg/50 border border-emerald-500/20 rounded-2xl p-4 space-y-4 animate-fade-in text-xs">
                  <div className="flex justify-between items-center border-b border-divider/10 pb-2">
                    <span className="text-[10px] font-bold text-status-healthy flex items-center gap-1.5 uppercase font-mono">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
                      Timeline Scanner Node
                    </span>
                    <button 
                      onClick={resetScannerState}
                      className="text-[9px] text-text-secondary hover:text-text-primary font-bold font-mono"
                    >
                      RESET
                    </button>
                  </div>

                  {!scanImage ? (
                    <div 
                      onClick={() => document.getElementById('crop-cam-upload')?.click()}
                      className="border-2 border-dashed border-divider hover:border-emerald-500/40 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white/60 space-y-2"
                    >
                      <input 
                        type="file"
                        id="crop-cam-upload"
                        className="hidden"
                        accept="image/*"
                        capture="environment"
                        onChange={handleScanImageChange}
                      />
                      <div className="w-8 h-8 rounded-full bg-inner-bg flex items-center justify-center text-text-secondary">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div className="text-center">
                        <span className="font-bold text-[10px] text-text-primary block">Take Photo or Upload Image</span>
                        <span className="text-[9px] text-text-secondary block mt-0.5">Captures visual features for lifecycle stage audit</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative h-40 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-divider/10">
                        <img 
                          src={scanImage} 
                          alt="Crop Scan Capture" 
                          className="max-h-full max-w-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[8px] py-0.5 px-1.5 rounded-full font-mono">
                          PREVIEW MATCH
                        </div>
                      </div>

                      {scanError && (
                        <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-[10px] text-status-critical font-medium">
                          ⚠️ {scanError}
                        </div>
                      )}

                      {scanResult ? (
                        <div className="p-3 bg-emerald-50/50 border border-emerald-100/50 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-status-healthy uppercase">Scan Successful</span>
                            <span className="font-mono font-bold text-text-secondary">Match: {scanResult.confidence}%</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/50 p-2 rounded-lg border border-divider/10">
                            <div>
                              <span className="text-text-secondary block">Detected Crop:</span>
                              <span className="font-bold text-text-primary">{scanResult.detectedCropType}</span>
                            </div>
                            <div>
                              <span className="text-text-secondary block">Growth Stage:</span>
                              <span className="font-bold text-navy-active uppercase">{scanResult.growthStage}</span>
                            </div>
                            <div>
                              <span className="text-text-secondary block">Health score:</span>
                              <span className="font-bold text-status-healthy">{scanResult.healthScore}%</span>
                            </div>
                            <div>
                              <span className="text-text-secondary block">Days to Harvest:</span>
                              <span className="font-bold text-emerald-600 font-mono">In {scanResult.estDaysToHarvest} Days</span>
                            </div>
                          </div>

                          <div className="text-[10px] leading-relaxed text-text-primary italic border-t border-divider/10 pt-2">
                            " {scanResult.visualObservations} "
                          </div>
                          
                          <p className="text-[8px] text-text-secondary leading-normal mt-1">
                            🌱 The 3D Procedural Plant and greenhouse lifecycle trackers have been fully updated.
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={runCropAnalysis}
                          disabled={isAnalyzingCrop}
                          className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                          {isAnalyzingCrop ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Analyzing physical stage logs via Gemini...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 fill-white/20" />
                              Run AI Timeline Analysis
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="relative flex justify-between items-center px-2 py-1 bg-inner-bg/10 rounded-2xl p-2.5">
                {/* Horizontal progress bar */}
                <div className="absolute top-6 left-6 right-6 h-0.5 bg-divider -z-10" />
                <div 
                  className="absolute top-6 left-6 h-0.5 bg-navy-active -z-10 transition-all" 
                  style={{
                    width: 
                      sensorData.growthStage === 'Seedling' ? '0%' :
                      sensorData.growthStage === 'Vegetative' ? '33%' :
                      sensorData.growthStage === 'Flowering' ? '66%' : '100%'
                  }}
                />

                {['Seedling', 'Vegetative', 'Flowering', 'Fruiting'].map((stage, idx) => {
                  const isActive = sensorData.growthStage === stage;
                  const stages = ['Seedling', 'Vegetative', 'Flowering', 'Fruiting'];
                  const currentIndex = stages.indexOf(sensorData.growthStage);
                  const isCompleted = stages.indexOf(stage) <= currentIndex;

                  return (
                    <div key={stage} className="flex flex-col items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isActive 
                          ? 'bg-navy-active text-white scale-110 shadow-md border-2 border-white' 
                          : isCompleted
                          ? 'bg-emerald-100 text-status-healthy'
                          : 'bg-white text-text-secondary border border-divider'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`text-[9px] font-semibold tracking-wide ${isActive ? 'text-navy-active' : 'text-text-secondary'}`}>
                        {stage}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cultivation metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-inner-bg/40 p-3.5 rounded-xl flex flex-col justify-center border border-divider/5">
                <span className="text-[10px] uppercase text-text-secondary font-medium tracking-wide flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-navy-active" />
                  Days Since Planted
                </span>
                <span className="text-lg font-bold text-text-primary mt-1">
                  {daysSincePlanted} Days
                </span>
                <span className="text-[9px] text-text-secondary font-medium mt-0.5 truncate">
                  Planted: {plantingDate}
                </span>
              </div>
              <div className="bg-inner-bg/40 p-3.5 rounded-xl flex flex-col justify-center border border-divider/5">
                <span className="text-[10px] uppercase text-text-secondary font-medium tracking-wide flex items-center gap-1 font-mono">
                  ⏱️ Est. Harvest Date
                </span>
                <span className="text-lg font-bold text-navy-active mt-1 font-mono">
                  {harvestDaysRemaining <= 0 ? 'Ready!' : `In ${harvestDaysRemaining} Days`}
                </span>
                <span className="text-[9px] text-text-secondary font-medium mt-0.5 truncate">
                  {aiHarvestDays !== null ? '⚡ AI Calibrated' : `Based on standard cycle`}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100/50 p-4 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-status-healthy shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-status-healthy">System Integrity High</h4>
              <p className="text-[11px] text-text-primary leading-normal">
                Microclimate sensors are fully synchronized. Automated irrigation and ventilation rules are actively preserving stable organic growth vectors.
              </p>
            </div>
          </div>
        </div>

        {/* Column 3: Actuator status indicators (3 cols) */}
        <div className="lg:col-span-3 bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 flex flex-col justify-between space-y-6">
          {/* Actuator Quick Check indicators */}
          <div className="space-y-3">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">Actuators Telemetry</span>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-primary font-medium flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${controlData.fanStatus ? 'bg-status-healthy animate-pulse' : 'bg-divider'}`} />
                  Air Ventilation Fan
                </span>
                <span className={`text-[10px] font-bold ${controlData.fanStatus ? 'text-status-healthy' : 'text-text-secondary'}`}>
                  {controlData.fanStatus ? 'RUNNING' : 'OFF'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-text-primary font-medium flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${controlData.pumpStatus ? 'bg-status-healthy animate-pulse' : 'bg-divider'}`} />
                  Hydration Water Pump
                </span>
                <span className={`text-[10px] font-bold ${controlData.pumpStatus ? 'text-status-healthy' : 'text-text-secondary'}`}>
                  {controlData.pumpStatus ? 'IRRIGATING' : 'IDLE'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-text-primary font-medium flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${controlData.lightStatus ? 'bg-status-healthy animate-pulse' : 'bg-divider'}`} />
                  Grow LEDs
                </span>
                <span className={`text-[10px] font-bold ${controlData.lightStatus ? 'text-status-healthy' : 'text-text-secondary'}`}>
                  {controlData.lightStatus ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
