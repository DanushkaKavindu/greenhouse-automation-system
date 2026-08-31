import { useState } from 'react';
import { Sparkles, Cpu, Camera } from 'lucide-react';
import DiseaseDetector from '../components/DiseaseDetector';
import ESP32CamFeed from '../components/ESP32CamFeed';

interface AIAnalysisProps {
  onUpdatePlantHeight?: (heightCm: number) => void;
  onUpdateHealthScore?: (score: number) => void;
}

export default function AIAnalysis({
  onUpdatePlantHeight,
  onUpdateHealthScore
}: AIAnalysisProps) {
  const [activeTab, setActiveTab] = useState<'disease' | 'esp32-cam'>('disease');

  return (
    <div id="ai-analysis-container" className="space-y-6 select-none text-left max-w-full overflow-hidden">

      {/* Page Header with AI Badging */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-50 to-emerald-50 border border-violet-100 rounded-full py-1 px-3 text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 fill-violet-400 stroke-none" />
            Gemini Agricultural Intellect Node
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary">AI Agronomic Analysis</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Real ESP32-CAM / webcam plant photo capture with Gemini Vision disease diagnosis and growth measurement.
          </p>
        </div>

        {/* Action Toggle Tabs - Horizontally scrollable on small screens */}
        <div className="w-full lg:w-auto bg-inner-bg p-1 rounded-xl flex items-center gap-1 text-[11px] font-semibold border border-divider/20 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('disease')}
            className={`py-2 px-3.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
              activeTab === 'disease' ? 'bg-navy-active text-white shadow-xs font-bold' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Camera className="w-4 h-4 stroke-[1.5]" />
            <span>Live AI Disease Detection</span>
          </button>
          <button
            onClick={() => setActiveTab('esp32-cam')}
            className={`py-2 px-3.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
              activeTab === 'esp32-cam' ? 'bg-navy-active text-white shadow-xs font-bold' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Cpu className="w-4 h-4 stroke-[1.5]" />
            <span>Hardware Telemetry & Firmware</span>
          </button>
        </div>
      </div>

      {/* Main Panel views */}
      {activeTab === 'esp32-cam' ? (
        <ESP32CamFeed
          onUpdatePlantHeight={onUpdatePlantHeight}
          onUpdateHealthScore={onUpdateHealthScore}
        />
      ) : (
        <DiseaseDetector
          onUpdatePlantHeight={onUpdatePlantHeight}
          onUpdateHealthScore={onUpdateHealthScore}
        />
      )}

    </div>
  );
}
