import { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { 
  TrendingUp, 
  Thermometer, 
  Droplets, 
  Activity, 
  Lightbulb, 
  Download, 
  Printer, 
  Calendar as CalendarIcon, 
  Clock, 
  FileSpreadsheet,
  Check,
  ChevronDown,
  FlaskConical,
  Leaf
} from 'lucide-react';
import {
  bucketByFixedWindows,
  dayRangeMs,
  readingsToPoints,
  useReadingsInRange,
  ChartPoint,
} from '../utils/telemetry';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'month' | 'week' | 'day' | 'custom'>('week');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [logFrequency, setLogFrequency] = useState<'minute' | 'hourly'>('hourly');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [chartMode, setChartMode] = useState<'environment' | 'npk'>('environment');

  // Fixed time windows for each period tab. Recomputed only when the tab or
  // custom date changes (not every render); useReadingsInRange refreshes
  // periodically whenever "now" falls inside the window.
  const dayWindow = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return [start.getTime(), end.getTime()] as [number, number];
  }, [activeTab]);

  const weekWindow = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return [start.getTime(), end.getTime()] as [number, number];
  }, [activeTab]);

  const monthWindow = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 28); // 4 clean weekly buckets
    return [start.getTime(), end.getTime()] as [number, number];
  }, [activeTab]);

  const customWindow = useMemo(() => dayRangeMs(selectedCustomDate), [selectedCustomDate]);

  // Real logged readings for whichever window is on screen. Each of these
  // comes back empty until the ESP32 actually reports data for that period
  // — nothing here is fabricated.
  const { readings: dayReadings, loading: dayLoading } = useReadingsInRange(dayWindow[0], dayWindow[1]);
  const { readings: weekReadings, loading: weekLoading } = useReadingsInRange(weekWindow[0], weekWindow[1]);
  const { readings: monthReadings, loading: monthLoading } = useReadingsInRange(monthWindow[0], monthWindow[1]);
  const { readings: customReadings, loading: customLoading } = useReadingsInRange(customWindow[0], customWindow[1]);

  // 24-Hour view: 6 four-hour buckets across today
  const data24h: ChartPoint[] = useMemo(() => bucketByFixedWindows(
    dayReadings, dayWindow[0], dayWindow[1], 6,
    (ms) => `${String(new Date(ms).getHours()).padStart(2, '0')}:00`
  ), [dayReadings, dayWindow]);

  // 7-Day view: one bucket per calendar day, most recent 7 days
  const data7d: ChartPoint[] = useMemo(() => bucketByFixedWindows(
    weekReadings, weekWindow[0], weekWindow[1], 7,
    (ms) => new Date(ms).toLocaleDateString([], { weekday: 'short' })
  ), [weekReadings, weekWindow]);

  // 30-Day view: 4 weekly buckets across the last 28 days
  const data30d: ChartPoint[] = useMemo(() => bucketByFixedWindows(
    monthReadings, monthWindow[0], monthWindow[1], 4,
    (_ms, idx) => `Week ${idx + 1}`
  ), [monthReadings, monthWindow]);

  // Custom date: either every real logged reading for that day, or an
  // hourly-averaged summary of them — never synthesized per-minute data.
  const minuteLogs: ChartPoint[] = useMemo(() => {
    if (logFrequency === 'minute') {
      return readingsToPoints(customReadings);
    }
    return bucketByFixedWindows(
      customReadings, customWindow[0], customWindow[1], 24,
      (ms) => `${String(new Date(ms).getHours()).padStart(2, '0')}:00`
    );
  }, [customReadings, customWindow, logFrequency]);

  const activeData: ChartPoint[] = useMemo(() => {
    if (activeTab === 'day') return data24h;
    if (activeTab === 'week') return data7d;
    if (activeTab === 'month') return data30d;
    return minuteLogs;
  }, [activeTab, data24h, data7d, data30d, minuteLogs]);

  const hasDataForActiveTab =
    activeTab === 'day' ? dayReadings.length > 0 :
    activeTab === 'week' ? weekReadings.length > 0 :
    activeTab === 'month' ? monthReadings.length > 0 :
    customReadings.length > 0;

  const isLoadingActiveTab =
    activeTab === 'day' ? dayLoading :
    activeTab === 'week' ? weekLoading :
    activeTab === 'month' ? monthLoading :
    customLoading;

  // Compute metric averages based on current active view — zero when there's
  // nothing logged for the period yet.
  const averages = useMemo(() => {
    const currentList = activeData;
    if (!currentList.length) return { 
      temp: '0.0°C', 
      humidity: '0.0%', 
      soil: '0.0%', 
      light: '0 lx',
      nitrogen: '0 mg/kg',
      phosphorus: '0 mg/kg',
      potassium: '0 mg/kg'
    };

    const sumTemp = currentList.reduce((acc, cur) => acc + cur.temp, 0);
    const sumHum = currentList.reduce((acc, cur) => acc + cur.humidity, 0);
    const sumSoil = currentList.reduce((acc, cur) => acc + cur.soil, 0);
    const sumLight = currentList.reduce((acc, cur) => acc + cur.light, 0);
    const sumN = currentList.reduce((acc, cur) => acc + (cur.nitrogen || 0), 0);
    const sumP = currentList.reduce((acc, cur) => acc + (cur.phosphorus || 0), 0);
    const sumK = currentList.reduce((acc, cur) => acc + (cur.potassium || 0), 0);
    const count = currentList.length;

    return {
      temp: `${(sumTemp / count).toFixed(1)}°C`,
      humidity: `${(sumHum / count).toFixed(1)}%`,
      soil: `${(sumSoil / count).toFixed(1)}%`,
      light: `${Math.round(sumLight / count)} lx`,
      nitrogen: `${Math.round(sumN / count)} mg/kg`,
      phosphorus: `${Math.round(sumP / count)} mg/kg`,
      potassium: `${Math.round(sumK / count)} mg/kg`
    };
  }, [activeData]);

  // Helper for triggering browser CSV downloads
  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvLines = [headers.join(','), ...rows.map(r => r.join(','))];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export handlers with complete NPK fields
  const handleExportDailyAverages = () => {
    const headers = ['Time', 'Temperature_C', 'Humidity_Pct', 'SoilMoisture_Pct', 'SolarLux', 'Nitrogen_mg_kg', 'Phosphorus_mg_kg', 'Potassium_mg_kg'];
    const rows = data24h.map(d => [d.time, d.temp, d.humidity, d.soil, d.light, d.nitrogen, d.phosphorus, d.potassium]);
    downloadCSV(`Daily_Averages_Report_24H.csv`, headers, rows);
  };

  const handleExportWeeklyAverages = () => {
    const headers = ['Day', 'Avg_Temperature_C', 'Avg_Humidity_Pct', 'Avg_SoilMoisture_Pct', 'Avg_SolarLux', 'Avg_Nitrogen_mg_kg', 'Avg_Phosphorus_mg_kg', 'Avg_Potassium_mg_kg'];
    const rows = data7d.map(d => [d.time, d.temp, d.humidity, d.soil, d.light, d.nitrogen, d.phosphorus, d.potassium]);
    downloadCSV(`Weekly_Averages_Report_7D.csv`, headers, rows);
  };

  const handleExportMonthlyAverages = () => {
    const headers = ['Week', 'Avg_Temperature_C', 'Avg_Humidity_Pct', 'Avg_SoilMoisture_Pct', 'Avg_SolarLux', 'Avg_Nitrogen_mg_kg', 'Avg_Phosphorus_mg_kg', 'Avg_Potassium_mg_kg'];
    const rows = data30d.map(d => [d.time, d.temp, d.humidity, d.soil, d.light, d.nitrogen, d.phosphorus, d.potassium]);
    downloadCSV(`Monthly_Averages_Report_30D.csv`, headers, rows);
  };

  const handleExportMinuteByMinute = () => {
    const headers = ['Date', 'Timestamp', 'Air_Temp_C', 'Air_Humidity_Pct', 'Soil_Moisture_Pct', 'Light_Lux', 'Nitrogen_mg_kg', 'Phosphorus_mg_kg', 'Potassium_mg_kg'];
    const rows = minuteLogs.map(l => [selectedCustomDate, l.time, l.temp, l.humidity, l.soil, l.light, l.nitrogen, l.phosphorus, l.potassium]);
    downloadCSV(`Minute_By_Minute_Telemetry_${selectedCustomDate}.csv`, headers, rows);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div id="reports-container" className="space-y-6 select-none text-left print:p-0 max-w-full overflow-hidden">
      
      {/* Header and Controls Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block font-mono">ANALYTICS ENGINE</span>
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary">Microclimate Historical Reports</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Visualize microclimatic curves, NPK soil nutrient telemetry, and export telemetry logs.
          </p>
        </div>

        {/* Top Right Period Selector Pill (Month | Week | Day | Custom) */}
        <div className="w-full sm:w-auto overflow-x-auto no-scrollbar print:hidden">
          <div className="bg-[#ebf0f5] p-1 rounded-full flex items-center shadow-inner border border-slate-200/60 w-max">
            <button
              onClick={() => setActiveTab('month')}
              className={`px-3.5 sm:px-4 py-1.5 text-xs rounded-full font-bold transition-all whitespace-nowrap ${
                activeTab === 'month' 
                  ? 'bg-[#0d1322] text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setActiveTab('week')}
              className={`px-3.5 sm:px-4 py-1.5 text-xs rounded-full font-bold transition-all whitespace-nowrap ${
                activeTab === 'week' 
                  ? 'bg-[#0d1322] text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setActiveTab('day')}
              className={`px-3.5 sm:px-4 py-1.5 text-xs rounded-full font-bold transition-all whitespace-nowrap ${
                activeTab === 'day' 
                  ? 'bg-[#0d1322] text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 text-xs rounded-full font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'custom' 
                  ? 'bg-[#0d1322] text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Custom
            </button>
          </div>
        </div>
      </div>

      {/* Date Picker Bar when Custom tab or date selection is active */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/80 p-3 rounded-2xl border border-divider/20 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-navy-active shrink-0" />
          <span className="text-xs font-bold text-text-primary uppercase font-mono">Custom Target Date:</span>
          <input 
            type="date"
            value={selectedCustomDate}
            onChange={(e) => {
              setSelectedCustomDate(e.target.value);
              setActiveTab('custom');
            }}
            className="bg-white border border-divider rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-navy-active shadow-inner"
          />
        </div>

        {/* Action Buttons: Export CSV & Print PDF */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <button
              onClick={() => setShowExportModal(!showExportModal)}
              className="w-full sm:w-auto py-2 px-3.5 sm:px-4 rounded-full bg-[#0d1322] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:bg-slate-800 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
              <ChevronDown className="w-3 h-3 text-white/60" />
            </button>

            {/* Export Dropdown Menu */}
            {showExportModal && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100 font-bold text-[10px] text-text-secondary uppercase tracking-wider font-mono">
                  Export Complete Datasets (.CSV)
                </div>
                <button
                  onClick={() => { handleExportDailyAverages(); setShowExportModal(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 font-medium text-text-primary flex items-center justify-between"
                >
                  <div>
                    <span className="block font-bold">Daily Average CSV (with NPK)</span>
                    <span className="text-[9px] text-text-secondary">24-hour summary packet</span>
                  </div>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                </button>
                <button
                  onClick={() => { handleExportWeeklyAverages(); setShowExportModal(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 font-medium text-text-primary flex items-center justify-between"
                >
                  <div>
                    <span className="block font-bold">Weekly Average CSV (with NPK)</span>
                    <span className="text-[9px] text-text-secondary">7-day summary packet</span>
                  </div>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                </button>
                <button
                  onClick={() => { handleExportMonthlyAverages(); setShowExportModal(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 font-medium text-text-primary flex items-center justify-between"
                >
                  <div>
                    <span className="block font-bold">Monthly Average CSV (with NPK)</span>
                    <span className="text-[9px] text-text-secondary">30-day summary packet</span>
                  </div>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                </button>
                <div className="border-t border-slate-100 pt-1 mt-1">
                  <button
                    onClick={() => { handleExportMinuteByMinute(); setShowExportModal(false); }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100/70 font-bold text-emerald-900 flex items-center justify-between"
                  >
                    <div>
                      <span className="block font-bold">Minute-by-Minute CSV (Full NPK)</span>
                      <span className="text-[9px] text-emerald-700">All channels for {selectedCustomDate}</span>
                    </div>
                    <Download className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handlePrintPDF}
            className="flex-1 sm:flex-initial py-2 px-3.5 sm:px-4 rounded-full bg-white border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all active:scale-95"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {!isLoadingActiveTab && !hasDataForActiveTab && (
        <div className="bg-amber-50 border border-amber-200/60 rounded-2xl px-4 py-3 flex items-center gap-2.5 text-amber-800">
          <Clock className="w-4 h-4 shrink-0" />
          <p className="text-xs font-semibold">
            No sensor readings have been logged for this period yet. Connect your ESP32 (or wait for it to report data) — every chart, average, and export below shows zero until then.
          </p>
        </div>
      )}

      {/* Averages Summary Grid (7 Cards: 4 Microclimate + 3 NPK Nutrients) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Temp Avg */}
        <div className="bg-card-bg rounded-[22px] p-3.5 shadow-glass border border-white/20 flex flex-col justify-between min-h-[110px]">
          <span className="text-[9px] text-text-secondary font-bold uppercase tracking-wider block font-mono truncate">AVG AIR TEMP</span>
          <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1">
            <span className="text-lg font-bold text-text-primary font-mono">{averages.temp}</span>
            <span className="text-[8px] text-status-healthy font-semibold px-1.5 py-0.2 rounded-full bg-green-50 border border-green-100">
              Optimal
            </span>
          </div>
          <span className="text-[8px] text-text-secondary font-medium border-t border-divider/20 pt-1.5 flex items-center gap-1 mt-1 truncate">
            <Thermometer className="w-3 h-3 text-rose-400 shrink-0" />
            Air microclimate
          </span>
        </div>

        {/* Humidity Avg */}
        <div className="bg-card-bg rounded-[22px] p-3.5 shadow-glass border border-white/20 flex flex-col justify-between min-h-[110px]">
          <span className="text-[9px] text-text-secondary font-bold uppercase tracking-wider block font-mono truncate">AVG HUMIDITY</span>
          <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1">
            <span className="text-lg font-bold text-text-primary font-mono">{averages.humidity}</span>
            <span className="text-[8px] text-status-healthy font-semibold px-1.5 py-0.2 rounded-full bg-green-50 border border-green-100">
              Optimal
            </span>
          </div>
          <span className="text-[8px] text-text-secondary font-medium border-t border-divider/20 pt-1.5 flex items-center gap-1 mt-1 truncate">
            <Droplets className="w-3 h-3 text-sky-400 shrink-0" />
            Transpiration safe
          </span>
        </div>

        {/* Soil Moisture Avg */}
        <div className="bg-card-bg rounded-[22px] p-3.5 shadow-glass border border-white/20 flex flex-col justify-between min-h-[110px]">
          <span className="text-[9px] text-text-secondary font-bold uppercase tracking-wider block font-mono truncate">AVG SOIL MOIST</span>
          <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1">
            <span className="text-lg font-bold text-text-primary font-mono">{averages.soil}</span>
            <span className="text-[8px] text-status-healthy font-semibold px-1.5 py-0.2 rounded-full bg-green-50 border border-green-100">
              Hydrated
            </span>
          </div>
          <span className="text-[8px] text-text-secondary font-medium border-t border-divider/20 pt-1.5 flex items-center gap-1 mt-1 truncate">
            <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
            Sub-drip cycles
          </span>
        </div>

        {/* Sunlight Lux Avg */}
        <div className="bg-card-bg rounded-[22px] p-3.5 shadow-glass border border-white/20 flex flex-col justify-between min-h-[110px]">
          <span className="text-[9px] text-text-secondary font-bold uppercase tracking-wider block font-mono truncate">AVG SOLAR LUX</span>
          <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1">
            <span className="text-lg font-bold text-amber-600 font-mono">{averages.light}</span>
            <span className="text-[8px] text-status-healthy font-semibold px-1.5 py-0.2 rounded-full bg-green-50 border border-green-100">
              Sufficient
            </span>
          </div>
          <span className="text-[8px] text-text-secondary font-medium border-t border-divider/20 pt-1.5 flex items-center gap-1 mt-1 truncate">
            <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
            Photon index
          </span>
        </div>

        {/* Nitrogen Avg */}
        <div className="bg-purple-50/70 rounded-[22px] p-3.5 shadow-glass border border-purple-200/60 flex flex-col justify-between min-h-[110px]">
          <span className="text-[9px] text-purple-900 font-bold uppercase tracking-wider block font-mono truncate">AVG NITROGEN (N)</span>
          <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1">
            <span className="text-lg font-bold text-purple-900 font-mono">{averages.nitrogen}</span>
            <span className="text-[8px] text-purple-700 font-bold px-1.5 py-0.2 rounded-full bg-purple-100">
              N-Rich
            </span>
          </div>
          <span className="text-[8px] text-purple-700 font-medium border-t border-purple-100 pt-1.5 flex items-center gap-1 mt-1 truncate">
            <FlaskConical className="w-3 h-3 text-purple-600 shrink-0" />
            Vegetative fuel
          </span>
        </div>

        {/* Phosphorus Avg */}
        <div className="bg-indigo-50/70 rounded-[22px] p-3.5 shadow-glass border border-indigo-200/60 flex flex-col justify-between min-h-[110px]">
          <span className="text-[9px] text-indigo-900 font-bold uppercase tracking-wider block font-mono truncate">AVG PHOSPHORUS (P)</span>
          <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1">
            <span className="text-lg font-bold text-indigo-900 font-mono">{averages.phosphorus}</span>
            <span className="text-[8px] text-indigo-700 font-bold px-1.5 py-0.2 rounded-full bg-indigo-100">
              P-Ready
            </span>
          </div>
          <span className="text-[8px] text-indigo-700 font-medium border-t border-indigo-100 pt-1.5 flex items-center gap-1 mt-1 truncate">
            <FlaskConical className="w-3 h-3 text-indigo-600 shrink-0" />
            Root & flower
          </span>
        </div>

        {/* Potassium Avg */}
        <div className="bg-teal-50/70 rounded-[22px] p-3.5 shadow-glass border border-teal-200/60 flex flex-col justify-between min-h-[110px]">
          <span className="text-[9px] text-teal-900 font-bold uppercase tracking-wider block font-mono truncate">AVG POTASSIUM (K)</span>
          <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1">
            <span className="text-lg font-bold text-teal-900 font-mono">{averages.potassium}</span>
            <span className="text-[8px] text-teal-700 font-bold px-1.5 py-0.2 rounded-full bg-teal-100">
              K-Balanced
            </span>
          </div>
          <span className="text-[8px] text-teal-700 font-medium border-t border-teal-100 pt-1.5 flex items-center gap-1 mt-1 truncate">
            <Leaf className="w-3 h-3 text-teal-600 shrink-0" />
            Immunity & vigor
          </span>
        </div>
      </div>

      {/* Main Recharts Graphic Chart with Channel Switcher */}
      <div className="bg-card-bg rounded-[28px] p-4 sm:p-6 shadow-glass border border-white/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-divider/40 pb-3 mb-4">
          <div className="space-y-0.5">
            <h3 className="text-xs sm:text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 font-mono">
              <TrendingUp className="w-4 h-4 text-navy-active" />
              {chartMode === 'environment' ? 'DYNAMIC MICROCLIMATE VARIANCE CURVES' : 'SOIL NPK NUTRIENT FLUCTUATION CURVES'}
            </h3>
            <p className="text-[11px] text-text-secondary">
              {chartMode === 'environment' 
                ? 'Plots Temperature (°C), Humidity (%), and Soil moisture (%) relative to time indices.' 
                : 'Plots Nitrogen (mg/kg), Phosphorus (mg/kg), and Potassium (mg/kg) soil chemistry.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Chart mode toggle */}
            <div className="bg-inner-bg p-0.5 rounded-xl flex text-[10px] font-bold border border-divider/20">
              <button
                onClick={() => setChartMode('environment')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartMode === 'environment' ? 'bg-navy-active text-white shadow-xs' : 'text-text-secondary'
                }`}
              >
                Microclimate
              </button>
              <button
                onClick={() => setChartMode('npk')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  chartMode === 'npk' ? 'bg-purple-700 text-white shadow-xs' : 'text-text-secondary'
                }`}
              >
                <FlaskConical className="w-3 h-3" />
                Soil NPK
              </button>
            </div>

            <span className="text-[10px] sm:text-xs font-bold text-navy-active uppercase font-mono bg-navy-active/10 px-2.5 py-1 rounded-xl shrink-0">
              {activeTab === 'month' ? '28-Day Month' : activeTab === 'week' ? '7-Day Week' : activeTab === 'day' ? '24-Hour Day' : selectedCustomDate}
            </span>
          </div>
        </div>

        {/* Recharts chart area */}
        <div className="w-full h-[240px] sm:h-[300px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'environment' ? (
              <AreaChart data={activeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSoil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                    fontSize: '11px' 
                  }} 
                />
                <Area type="monotone" dataKey="temp" name="Temperature (°C)" stroke="#f43f5e" strokeWidth={1.5} fillOpacity={1} fill="url(#colorTemp)" />
                <Area type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#38bdf8" strokeWidth={1.5} fillOpacity={1} fill="url(#colorHum)" />
                <Area type="monotone" dataKey="soil" name="Soil Moisture (%)" stroke="#34d399" strokeWidth={1.5} fillOpacity={1} fill="url(#colorSoil)" />
              </AreaChart>
            ) : (
              <AreaChart data={activeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorN" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorK" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                    fontSize: '11px' 
                  }} 
                />
                <Area type="monotone" dataKey="nitrogen" name="Nitrogen (mg/kg)" stroke="#9333ea" strokeWidth={2} fillOpacity={1} fill="url(#colorN)" />
                <Area type="monotone" dataKey="phosphorus" name="Phosphorus (mg/kg)" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorP)" />
                <Area type="monotone" dataKey="potassium" name="Potassium (mg/kg)" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorK)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Continuous Log Index (Scrollable Index of Localized Sensor Data Packets) */}
      <div className="bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-divider/30 pb-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-mono flex items-center gap-2">
              <Clock className="w-4 h-4 text-navy-active" />
              Continuous Log Index
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Scrollable index of localized sensor data packets for <span className="font-mono font-bold text-text-primary">{selectedCustomDate}</span> including RS485 NPK telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Frequency switch */}
            <div className="bg-inner-bg p-0.5 rounded-xl flex text-[10px] font-bold border border-divider/20">
              <button
                onClick={() => setLogFrequency('hourly')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  logFrequency === 'hourly' ? 'bg-navy-active text-white shadow-xs' : 'text-text-secondary'
                }`}
              >
                Hourly
              </button>
              <button
                onClick={() => setLogFrequency('minute')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  logFrequency === 'minute' ? 'bg-navy-active text-white shadow-xs' : 'text-text-secondary'
                }`}
              >
                Minute-by-Minute
              </button>
            </div>

            {/* Quick Export Minute CSV Button */}
            <button
              onClick={handleExportMinuteByMinute}
              className="py-1.5 px-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px] flex items-center gap-1.5 hover:bg-emerald-100 transition-colors shadow-xs"
            >
              <Download className="w-3 h-3 text-emerald-600" />
              Download CSV ({selectedCustomDate})
            </button>
          </div>
        </div>

        {/* Scrollable Data Packet Table */}
        <div className="max-h-[340px] overflow-y-auto rounded-2xl border border-divider/20 bg-white/40 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-divider/20">
              <tr className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">
                <th className="py-3 px-4">Time Offset</th>
                <th className="py-3 px-4">Temp (°C)</th>
                <th className="py-3 px-4">Humidity (%)</th>
                <th className="py-3 px-4">Soil (%)</th>
                <th className="py-3 px-4">Light (Lux)</th>
                <th className="py-3 px-4 text-purple-800">N (mg/kg)</th>
                <th className="py-3 px-4 text-indigo-800">P (mg/kg)</th>
                <th className="py-3 px-4 text-teal-800">K (mg/kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider/10 text-xs font-mono">
              {minuteLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-inner-bg/40 transition-colors">
                  <td className="py-2.5 px-4 text-text-secondary font-medium">{log.time}</td>
                  <td className="py-2.5 px-4 font-bold text-text-primary">{log.temp}°C</td>
                  <td className="py-2.5 px-4 text-text-primary">{log.humidity}%</td>
                  <td className="py-2.5 px-4 text-text-primary">{log.soil}%</td>
                  <td className={`py-2.5 px-4 font-bold ${log.light > 0 ? 'text-amber-600' : 'text-text-secondary'}`}>
                    {log.light.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-purple-700">{log.nitrogen}</td>
                  <td className="py-2.5 px-4 font-bold text-indigo-700">{log.phosphorus}</td>
                  <td className="py-2.5 px-4 font-bold text-teal-700">{log.potassium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

