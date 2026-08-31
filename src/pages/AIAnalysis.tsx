import { useState } from 'react';
import { Brain, Leaf, RotateCw, Sparkles, TrendingUp, Calendar, Info, Cpu, Camera } from 'lucide-react';
import DiseaseDetector from '../components/DiseaseDetector';
import PlantGrowth3D from '../components/PlantGrowth3D';
import ESP32CamFeed from '../components/ESP32CamFeed';
import { DiseaseDetectionHistory, SensorData } from '../types';

interface AIAnalysisProps {
  sensorData: SensorData;
  diagnosisHistory: DiseaseDetectionHistory[];
  onAddDiagnosis: (item: DiseaseDetectionHistory) => void;
  onUpdatePlantHeight?: (heightCm: number) => void;
  onUpdateHealthScore?: (score: number) => void;
}

export default function AIAnalysis({ 
  sensorData, 
  diagnosisHistory, 
  onAddDiagnosis,
  onUpdatePlantHeight,
  onUpdateHealthScore
}: AIAnalysisProps) {
  const [activeTab, setActiveTab] = useState<'disease' | 'esp32-cam' | 'growth'>('disease');

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
            Real-time automated dual ESP32-CAM live stream monitoring, pathological AI diagnostics, and 3D physiological models.
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
            <span>Live Dual-CAM AI Analysis</span>
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
          <button
            onClick={() => setActiveTab('growth')}
            className={`py-2 px-3.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
              activeTab === 'growth' ? 'bg-navy-active text-white shadow-xs font-bold' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <RotateCw className="w-4 h-4 stroke-[1.5]" />
            <span>3D Plant Model</span>
          </button>
        </div>
      </div>

      {/* Main Panel views */}
      {activeTab === 'esp32-cam' ? (
        <ESP32CamFeed 
          onUpdatePlantHeight={onUpdatePlantHeight}
          onUpdateHealthScore={onUpdateHealthScore}
        />
      ) : activeTab === 'disease' ? (
        <div className="space-y-6">
          <DiseaseDetector 
            history={diagnosisHistory} 
            onAddHistory={onAddDiagnosis} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          
          {/* Detailed 3D Model Render Card */}
          <div className="lg:col-span-4 bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">Interactive Frame</span>
              <h3 className="text-lg font-semibold text-text-primary">3D Cultivar Structure</h3>
              <p className="text-xs text-text-secondary">
                Drag the viewport horizontally to audit branches, leaf surface area, flowers, and fruit pods in 3D.
              </p>
            </div>

            <div className="bg-white/40 p-4 rounded-2xl border border-white/40">
              <PlantGrowth3D 
                growthStage={sensorData.growthStage} 
                healthScore={sensorData.healthScore} 
              />
            </div>
          </div>

          {/* Plant Growth Statistics & Analytics Panel */}
          <div className="lg:col-span-8 bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">AGRICULTURAL PROJECTION</span>
                <h3 className="text-lg font-semibold text-text-primary">Physiological Development Analytics</h3>
              </div>

              {/* Development details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-inner-bg/40 p-4 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">Accumulated GDD</span>
                  <div className="text-xl font-bold text-text-primary">
                    {sensorData.growthStage === 'Seedling' ? '124' :
                     sensorData.growthStage === 'Vegetative' ? '458' :
                     sensorData.growthStage === 'Flowering' ? '812' : '1,054'}
                  </div>
                  <p className="text-[10px] text-text-secondary">Growing Degree Days offset calculated from local Lanka solar averages.</p>
                </div>

                <div className="bg-inner-bg/40 p-4 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">Evapotranspiration</span>
                  <div className="text-xl font-bold text-text-primary">4.2 mm/day</div>
                  <p className="text-[10px] text-text-secondary">Rate of moisture release from green chilli leaves into the microclimate.</p>
                </div>

                <div className="bg-inner-bg/40 p-4 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">Soil Microbial Index</span>
                  <div className="text-xl font-bold text-status-healthy">94 / 100</div>
                  <p className="text-[10px] text-text-secondary">Proportion of organic root nitrogen-fixation health calculated via moisture stability.</p>
                </div>
              </div>

              {/* Developmental Milestones */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-navy-active" />
                  Cultivation Stage Milestones
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-inner-bg/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-100 text-status-healthy flex items-center justify-center font-bold">✓</span>
                      <div>
                        <h5 className="font-bold text-text-primary">Vegetative Expansion Node</h5>
                        <p className="text-[10px] text-text-secondary">Lateral branching and photosynthesis density optimized.</p>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-text-secondary self-end sm:self-auto text-[10px]">Completed</span>
                  </div>

                  <div className="p-3 bg-inner-bg/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-100 text-status-healthy flex items-center justify-center font-bold">✓</span>
                      <div>
                        <h5 className="font-bold text-text-primary">Green Chilli Blossom Apex</h5>
                        <p className="text-[10px] text-text-secondary">Small white flowers emerged at nodes (58 days since seed).</p>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-text-secondary self-end sm:self-auto text-[10px]">Completed</span>
                  </div>

                  <div className="p-3 bg-inner-bg/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">➜</span>
                      <div>
                        <h5 className="font-bold text-text-primary">Fruit/Pod Development</h5>
                        <p className="text-[10px] text-text-secondary">Accumulating chlorophyll in fruits. Harvesting estimate in 14 days.</p>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-navy-active self-end sm:self-auto text-[10px]">Active Stage</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-inner-bg p-4 rounded-2xl flex items-start gap-3 mt-4 border border-divider/25">
              <Info className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-text-primary">Agronomic Expert Advice</h4>
                <p className="text-[11px] text-text-secondary leading-normal">
                  Chilli pod length is currently proportional to potassium levels. Supplement organic wood-ash tea inside water pump cycles once per week to increase chilli wall thickness and spice hotness.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
