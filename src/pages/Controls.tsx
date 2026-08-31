import { Sliders, Fan, Droplet, Lightbulb, Play, AlertTriangle, ShieldCheck, Activity, Cpu, Thermometer, Sun, FlaskConical, Leaf } from 'lucide-react';
import { SensorData, ControlData, Thresholds } from '../types';

interface ControlsProps {
  sensorData: SensorData;
  controlData: ControlData;
  onUpdateControl: (field: keyof ControlData, value: boolean) => void;
  thresholds: Thresholds;
  onUpdateThresholds: (newThresholds: Thresholds) => void;
  updateInterval: number;
  onUpdateIntervalChange: (interval: number) => void;
  onOpenHardwareModal?: () => void;
  isHardwareConnected?: boolean;
  lastHeartbeat?: string | null;
}

export default function Controls({ 
  sensorData, 
  controlData, 
  onUpdateControl, 
  thresholds, 
  onUpdateThresholds,
  updateInterval,
  onUpdateIntervalChange,
  onOpenHardwareModal,
  isHardwareConnected,
  lastHeartbeat,
}: ControlsProps) {

  const nVal = sensorData.nitrogen ?? 165;
  const pVal = sensorData.phosphorus ?? 48;
  const kVal = sensorData.potassium ?? 210;

  const nLowLimit = thresholds.nitrogenLow ?? 130;
  const pLowLimit = thresholds.phosphorusLow ?? 30;
  const kLowLimit = thresholds.potassiumLow ?? 150;

  // Dynamically compute rule active/idle status based on real-time sensors
  const rules = [
    {
      id: 'rule_temp_high',
      title: '🚨 Vent Over-Temperature Safeguard',
      desc: `Triggers when Air Temp > ${thresholds.tempHigh}°C to expel warm air.`,
      condition: `Air Temp (${sensorData.temperature}°C) > ${thresholds.tempHigh}°C`,
      isActive: sensorData.temperature > thresholds.tempHigh,
      actuator: 'Ventilation Fan',
      action: 'TURN ON',
    },
    {
      id: 'rule_soil_low',
      title: '💧 Desiccation Irrigation Trigger',
      desc: `Triggers when Soil Moisture < ${thresholds.soilLow}% to prevent crop dehydration.`,
      condition: `Soil Moisture (${sensorData.soilMoisture}%) < ${thresholds.soilLow}%`,
      isActive: sensorData.soilMoisture < thresholds.soilLow,
      actuator: 'Water Pump',
      action: 'TURN ON',
    },
    {
      id: 'rule_npk_nitrogen',
      title: '🧪 Nitrogen Enrichment Soluble Dosing',
      desc: `Triggers when Soil Nitrogen < ${nLowLimit} mg/kg to sustain vegetative leaf growth.`,
      condition: `Soil Nitrogen (${nVal} mg/kg) < ${nLowLimit} mg/kg`,
      isActive: nVal < nLowLimit,
      actuator: 'Irrigation Nutrients',
      action: 'DISPENSE N-FEED',
    },
    {
      id: 'rule_light_low',
      title: '☀️ Insufficient Sunlight Supplement',
      desc: `Triggers when LDR Ambient Light < ${thresholds.lightLow} lx to supplement grow photons.`,
      condition: `Ambient Light (${sensorData.lightIntensity} lx) < ${thresholds.lightLow} lx`,
      isActive: sensorData.lightIntensity < thresholds.lightLow,
      actuator: 'Grow LEDs',
      action: 'TURN ON',
    },
    {
      id: 'rule_npk_potassium',
      title: '🌾 Potash (K) Root Strengthening Trigger',
      desc: `Triggers when Potassium < ${kLowLimit} mg/kg for root resilience.`,
      condition: `Soil Potassium (${kVal} mg/kg) < ${kLowLimit} mg/kg`,
      isActive: kVal < kLowLimit,
      actuator: 'Nutrient Injector',
      action: 'DISPENSE K-BOOST',
    },
    {
      id: 'rule_soil_high',
      title: '🛡️ Satiated Irrigation Shut-Off',
      desc: `Shuts off water when soil exceeds ${thresholds.soilHigh}% to prevent root rot and fungus.`,
      condition: `Soil Moisture (${sensorData.soilMoisture}%) > ${thresholds.soilHigh}%`,
      isActive: sensorData.soilMoisture > thresholds.soilHigh,
      actuator: 'Water Pump',
      action: 'TURN OFF',
    },
    {
      id: 'rule_temp_low',
      title: '❄️ Thermal Equilibrium Rest',
      desc: `Turns off fan when temperature cools below ${thresholds.tempLow}°C.`,
      condition: `Air Temp (${sensorData.temperature}°C) < ${thresholds.tempLow}°C`,
      isActive: sensorData.temperature < thresholds.tempLow,
      actuator: 'Ventilation Fan',
      action: 'TURN OFF',
    },
    {
      id: 'rule_light_high',
      title: '🌿 Daylight Conservation Shut-Off',
      desc: `Shuts off LEDs when natural daylight exceeds ${thresholds.lightHigh} lx to save energy.`,
      condition: `Ambient Light (${sensorData.lightIntensity} lx) > ${thresholds.lightHigh} lx`,
      isActive: sensorData.lightIntensity > thresholds.lightHigh,
      actuator: 'Grow LEDs',
      action: 'TURN OFF',
    },
  ];

  // Prevent toggle if in automated mode
  const handleToggle = (field: keyof ControlData, currentValue: boolean) => {
    if (controlData.autoMode) {
      alert('To manually toggle devices, switch Greenhouse Mode to "Manual Override" first in the top bar.');
      return;
    }
    onUpdateControl(field, !currentValue);
  };

  const handleThresholdChange = (key: keyof Thresholds, value: number) => {
    const updated = { ...thresholds, [key]: value };
    
    // Safety guard rails to prevent invalid logical overlaps:
    if (key === 'tempHigh' && value <= thresholds.tempLow) {
      updated.tempLow = value - 1;
    } else if (key === 'tempLow' && value >= thresholds.tempHigh) {
      updated.tempHigh = value + 1;
    } else if (key === 'soilHigh' && value <= thresholds.soilLow) {
      updated.soilLow = value - 5;
    } else if (key === 'soilLow' && value >= thresholds.soilHigh) {
      updated.soilHigh = value + 5;
    } else if (key === 'lightHigh' && value <= thresholds.lightLow) {
      updated.lightLow = value - 100;
    } else if (key === 'lightLow' && value >= thresholds.lightHigh) {
      updated.lightHigh = value + 100;
    } else if (key === 'nitrogenHigh' && value <= (thresholds.nitrogenLow ?? 130)) {
      updated.nitrogenLow = value - 10;
    } else if (key === 'nitrogenLow' && value >= (thresholds.nitrogenHigh ?? 210)) {
      updated.nitrogenHigh = value + 10;
    } else if (key === 'potassiumHigh' && value <= (thresholds.potassiumLow ?? 150)) {
      updated.potassiumLow = value - 10;
    } else if (key === 'potassiumLow' && value >= (thresholds.potassiumHigh ?? 260)) {
      updated.potassiumHigh = value + 10;
    }

    // Keep within logical minimum/maximum limits
    updated.tempHigh = Math.min(45, Math.max(25, updated.tempHigh));
    updated.tempLow = Math.min(30, Math.max(15, updated.tempLow));
    updated.soilHigh = Math.min(95, Math.max(50, updated.soilHigh));
    updated.soilLow = Math.min(60, Math.max(10, updated.soilLow));
    updated.lightHigh = Math.min(1500, Math.max(500, updated.lightHigh));
    updated.lightLow = Math.min(600, Math.max(50, updated.lightLow));

    onUpdateThresholds(updated);
  };

  return (
    <div id="controls-container" className="space-y-6 select-none text-left">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">ACTUATORS & TRIGGERS</span>
          <h2 className="text-2xl font-bold text-text-primary">Device & Automation Controls</h2>
          <p className="text-xs text-text-secondary">
            Configure physical actuators or check automated rule synchronization.
          </p>
        </div>

        {onOpenHardwareModal && (
          <button
            onClick={onOpenHardwareModal}
            className={`py-2 px-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all shadow-xs self-start sm:self-auto ${
              isHardwareConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-inner-bg text-text-primary border-divider/30 hover:border-navy-active/50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              isHardwareConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'
            }`} />
            <span>{isHardwareConnected ? 'ESP32 Relays Synced' : 'Connect Real Relays & ESP32'}</span>
          </button>
        )}
      </div>

      {/* Mode Alert Warning */}
      {controlData.autoMode ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-status-healthy shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-status-healthy">Automated Care Mode is active</h4>
            <p className="text-[11px] text-text-primary leading-normal">
              The system is regulating fans, pumps, and lights automatically using active sensor rules. Manual controls are locked to prevent rule conflict. Toggle "Manual Override" to operate devices.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-status-warning">Manual Override Mode is active</h4>
            <p className="text-[11px] text-text-primary leading-normal">
              Automated smart rules are temporarily suspended. You are responsible for regulating greenhouse conditions.
            </p>
          </div>
        </div>
      )}

      {/* Manual Actuator Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Fan Control */}
        <div className="bg-card-bg rounded-[24px] p-6 shadow-glass border border-white/20 flex flex-col justify-between h-[180px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-text-secondary uppercase font-semibold block">Actuator 01</span>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Fan className={`w-4 h-4 text-rose-400 ${controlData.fanStatus ? 'animate-spin' : ''}`} />
                Ventilation Fan
              </h3>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
              controlData.fanStatus ? 'bg-green-50 text-status-healthy' : 'bg-inner-bg text-text-secondary'
            }`}>
              {controlData.fanStatus ? 'ON' : 'OFF'}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-divider/30 pt-3">
            <span className="text-[10px] text-text-secondary font-semibold">Exhaust/Cooling node</span>
            <button
              onClick={() => handleToggle('fanStatus', controlData.fanStatus)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-sm transition-all ${
                controlData.autoMode 
                  ? 'bg-inner-bg text-text-secondary cursor-not-allowed' 
                  : controlData.fanStatus 
                  ? 'bg-rose-500 text-white hover:bg-rose-600' 
                  : 'bg-navy-active text-white hover:shadow-md'
              }`}
            >
              {controlData.fanStatus ? 'Stop Fan' : 'Start Fan'}
            </button>
          </div>
        </div>

        {/* Irrigation Pump Control */}
        <div className="bg-card-bg rounded-[24px] p-6 shadow-glass border border-white/20 flex flex-col justify-between h-[180px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-text-secondary uppercase font-semibold block">Actuator 02</span>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Droplet className={`w-4 h-4 text-sky-400 ${controlData.pumpStatus ? 'animate-pulse' : ''}`} />
                Water Pump
              </h3>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
              controlData.pumpStatus ? 'bg-green-50 text-status-healthy' : 'bg-inner-bg text-text-secondary'
            }`}>
              {controlData.pumpStatus ? 'IRRIGATING' : 'IDLE'}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-divider/30 pt-3">
            <span className="text-[10px] text-text-secondary font-semibold">Micro-drip irrigation</span>
            <button
              onClick={() => handleToggle('pumpStatus', controlData.pumpStatus)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-sm transition-all ${
                controlData.autoMode 
                  ? 'bg-inner-bg text-text-secondary cursor-not-allowed' 
                  : controlData.pumpStatus 
                  ? 'bg-rose-500 text-white hover:bg-rose-600' 
                  : 'bg-navy-active text-white hover:shadow-md'
              }`}
            >
              {controlData.pumpStatus ? 'Stop Pump' : 'Start Pump'}
            </button>
          </div>
        </div>

        {/* LED Grow Lights Control */}
        <div className="bg-card-bg rounded-[24px] p-6 shadow-glass border border-white/20 flex flex-col justify-between h-[180px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-text-secondary uppercase font-semibold block">Actuator 03</span>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Lightbulb className={`w-4 h-4 text-amber-400 ${controlData.lightStatus ? 'animate-pulse' : ''}`} />
                Grow LEDs
              </h3>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
              controlData.lightStatus ? 'bg-green-50 text-status-healthy' : 'bg-inner-bg text-text-secondary'
            }`}>
              {controlData.lightStatus ? 'ON' : 'OFF'}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-divider/30 pt-3">
            <span className="text-[10px] text-text-secondary font-semibold">Grow spectrum arrays</span>
            <button
              onClick={() => handleToggle('lightStatus', controlData.lightStatus)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-sm transition-all ${
                controlData.autoMode 
                  ? 'bg-inner-bg text-text-secondary cursor-not-allowed' 
                  : controlData.lightStatus 
                  ? 'bg-rose-500 text-white hover:bg-rose-600' 
                  : 'bg-navy-active text-white hover:shadow-md'
              }`}
            >
              {controlData.lightStatus ? 'Lights OFF' : 'Lights ON'}
            </button>
          </div>
        </div>

      </div>

      {/* Threshold Settings Panel */}
      <div className="bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 text-left space-y-5">
        <div>
          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">TUNING INTERFACE</span>
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Sliders className="w-5 h-5 text-navy-active" />
            Microclimate Automation Thresholds
          </h3>
          <p className="text-xs text-text-secondary">
            Fine-tune active ranges for automated cooling, drip irrigation, and grow LED photon supplementation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Temperature Thresholds Card */}
          <div className="bg-inner-bg/40 border border-divider/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-divider/10 pb-2">
              <Thermometer className="w-5 h-5 text-rose-500" />
              <div>
                <h4 className="text-xs font-bold text-text-primary">Temperature Guard</h4>
                <span className="text-[10px] text-text-secondary">Ventilation fan targets</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* High Temp */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary font-semibold">Fan START Trigger (High)</span>
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{thresholds.tempHigh}°C</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="45"
                  step="0.5"
                  value={thresholds.tempHigh}
                  onChange={(e) => handleThresholdChange('tempHigh', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-divider rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-[8px] text-text-secondary">
                  <span>25°C</span>
                  <span>Recommended: 32°C</span>
                  <span>45°C</span>
                </div>
              </div>

              {/* Low Temp */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary font-semibold">Fan STOP Target (Low)</span>
                  <span className="font-mono font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">{thresholds.tempLow}°C</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="30"
                  step="0.5"
                  value={thresholds.tempLow}
                  onChange={(e) => handleThresholdChange('tempLow', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-divider rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex justify-between text-[8px] text-text-secondary">
                  <span>15°C</span>
                  <span>Recommended: 26°C</span>
                  <span>30°C</span>
                </div>
              </div>
            </div>
          </div>

          {/* Soil Moisture Thresholds Card */}
          <div className="bg-inner-bg/40 border border-divider/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-divider/10 pb-2">
              <Droplet className="w-5 h-5 text-sky-500" />
              <div>
                <h4 className="text-xs font-bold text-text-primary">Hydration Guard</h4>
                <span className="text-[10px] text-text-secondary">Drip irrigation bounds</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Low Soil */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary font-semibold">Pump START Trigger (Dry)</span>
                  <span className="font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{thresholds.soilLow}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="1"
                  value={thresholds.soilLow}
                  onChange={(e) => handleThresholdChange('soilLow', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-divider rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[8px] text-text-secondary">
                  <span>10%</span>
                  <span>Recommended: 40%</span>
                  <span>60%</span>
                </div>
              </div>

              {/* High Soil */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary font-semibold">Pump STOP Target (Satiated)</span>
                  <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{thresholds.soilHigh}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="1"
                  value={thresholds.soilHigh}
                  onChange={(e) => handleThresholdChange('soilHigh', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-divider rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[8px] text-text-secondary">
                  <span>50%</span>
                  <span>Recommended: 70%</span>
                  <span>95%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Light Level Thresholds Card */}
          <div className="bg-inner-bg/40 border border-divider/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-divider/10 pb-2">
              <Sun className="w-5 h-5 text-amber-500" />
              <div>
                <h4 className="text-xs font-bold text-text-primary">Sunlight Supplement</h4>
                <span className="text-[10px] text-text-secondary">Grow LED spectrum limits</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Low Light */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary font-semibold">LEDs START Trigger (Dark)</span>
                  <span className="font-mono font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">{thresholds.lightLow} lx</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="600"
                  step="10"
                  value={thresholds.lightLow}
                  onChange={(e) => handleThresholdChange('lightLow', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-divider rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
                <div className="flex justify-between text-[8px] text-text-secondary">
                  <span>50 lx</span>
                  <span>Recommended: 300 lx</span>
                  <span>600 lx</span>
                </div>
              </div>

              {/* High Light */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary font-semibold">LEDs STOP Target (Bright)</span>
                  <span className="font-mono font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{thresholds.lightHigh} lx</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="1500"
                  step="10"
                  value={thresholds.lightHigh}
                  onChange={(e) => handleThresholdChange('lightHigh', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-divider rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[8px] text-text-secondary">
                  <span>500 lx</span>
                  <span>Recommended: 800 lx</span>
                  <span>1500 lx</span>
                </div>
              </div>
            </div>
          </div>

          {/* Soil NPK Fertility Thresholds Card */}
          <div className="bg-purple-50/40 border border-purple-200/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-purple-100 pb-2">
              <FlaskConical className="w-5 h-5 text-purple-600" />
              <div>
                <h4 className="text-xs font-bold text-purple-900">NPK Nutrient Guard</h4>
                <span className="text-[10px] text-purple-700">Dosing trigger bounds</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Nitrogen Low Trigger */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-purple-800 font-semibold">Nitrogen Low Trigger</span>
                  <span className="font-mono font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">{thresholds.nitrogenLow ?? 130} mg/kg</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="200"
                  step="5"
                  value={thresholds.nitrogenLow ?? 130}
                  onChange={(e) => handleThresholdChange('nitrogenLow', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-[8px] text-purple-600">
                  <span>80</span>
                  <span>Optimal: 140 - 200</span>
                  <span>200</span>
                </div>
              </div>

              {/* Potassium Low Trigger */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-teal-800 font-semibold">Potassium (K) Low Trigger</span>
                  <span className="font-mono font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">{thresholds.potassiumLow ?? 150} mg/kg</span>
                </div>
                <input
                  type="range"
                  min="90"
                  max="220"
                  step="5"
                  value={thresholds.potassiumLow ?? 150}
                  onChange={(e) => handleThresholdChange('potassiumLow', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-teal-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                />
                <div className="flex justify-between text-[8px] text-teal-600">
                  <span>90</span>
                  <span>Optimal: 160 - 250</span>
                  <span>220</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Sync Rate Controller */}
        <div className="border-t border-divider/30 pt-6 mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                Real-Time Refresh Rate & ESP32 Sync Speed
              </h4>
              <p className="text-[11px] text-text-secondary">
                Configure telemetry intervals. Lower values (&lt; 1 second) provide instantaneous feedback on actuator responses and microclimatic drift.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-inner-bg p-1.5 rounded-xl border border-divider/10 shrink-0 self-start sm:self-auto">
              <span className="text-[10px] text-text-secondary font-semibold pl-1.5 pr-2">Live Pulse:</span>
              <span className="relative flex h-3.5 w-3.5 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" style={{ animationDuration: `${updateInterval}ms` }}></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-xs font-bold text-text-primary pr-1">{updateInterval / 1000}s</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '0.5s (Ultra-Fast)', value: 500, desc: 'Instantly responsive' },
              { label: '0.8s (Real-Time)', value: 800, desc: 'Default high-refresh' },
              { label: '1.0s (Standard)', value: 1000, desc: 'Standard cellular rate' },
              { label: '2.5s (Eco-Mode)', value: 2500, desc: 'Saves ESP32 battery' },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => onUpdateIntervalChange(preset.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  updateInterval === preset.value
                    ? 'bg-navy-active text-white border-navy-active shadow-sm scale-[1.02]'
                    : 'bg-inner-bg/30 border-divider/10 hover:bg-inner-bg/60 text-text-primary'
                }`}
              >
                <div className="text-xs font-bold leading-tight">{preset.label}</div>
                <div className={`text-[9px] mt-0.5 ${updateInterval === preset.value ? 'text-white/80' : 'text-text-secondary'}`}>
                  {preset.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Smart Automation Rules Directory */}
      <div className="bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20">
        <div className="flex items-center justify-between border-b border-divider/40 pb-4 mb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Cpu className="w-5 h-5 text-navy-active" />
              Smart Automation Rules Directory
            </h3>
            <p className="text-xs text-text-secondary">
              Review current logical state conditions being executed in real-time.
            </p>
          </div>
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest bg-inner-bg px-3 py-1 rounded-full border border-divider/10">
            {rules.length} Rules Syncing
          </span>
        </div>

        {/* Rule Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 rounded-2xl border transition-colors flex flex-col justify-between h-[140px] ${
                rule.isActive && controlData.autoMode
                  ? 'bg-emerald-50/50 border-emerald-100/60'
                  : 'bg-inner-bg/40 border-divider/20'
              }`}
            >
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-text-primary leading-tight">
                    {rule.title}
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                    rule.isActive && controlData.autoMode
                      ? 'bg-emerald-100 text-status-healthy'
                      : 'bg-divider/50 text-text-secondary'
                  }`}>
                    {rule.isActive && controlData.autoMode ? 'ACTIVE' : 'IDLE'}
                  </span>
                </div>
                <p className="text-[10px] text-text-secondary leading-normal">
                  {rule.desc}
                </p>
              </div>

              <div className="border-t border-divider/20 pt-2 flex items-center justify-between text-[10px]">
                <div>
                  <span className="text-text-secondary block font-semibold uppercase text-[8px]">Trigger Condition</span>
                  <span className="font-mono text-text-primary font-bold">{rule.condition}</span>
                </div>
                <div className="text-right">
                  <span className="text-text-secondary block font-semibold uppercase text-[8px]">Target Actuator</span>
                  <span className="font-bold text-navy-active">{rule.actuator} ➜ {rule.action}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
