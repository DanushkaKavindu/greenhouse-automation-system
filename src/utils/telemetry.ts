import { useEffect, useState } from 'react';
import { fetchReadingsInRange, SensorReadingLog } from '../firebase';

export interface DailyAverages {
  dateStr: string;
  temp: string;
  tempRaw: number;
  humidity: string;
  humidityRaw: number;
  soil: string;
  soilRaw: number;
  light: string;
  lightRaw: number;
  nitrogen: string;
  nitrogenRaw: number;
  phosphorus: string;
  phosphorusRaw: number;
  potassium: string;
  potassiumRaw: number;
  // How many real readings this average is built from. 0 means "no data
  // logged for this date yet" — every value above is a genuine zero, not a
  // placeholder.
  sampleCount: number;
}

function zeroAverages(dateStr: string): DailyAverages {
  return {
    dateStr,
    temp: '0.0°C', tempRaw: 0,
    humidity: '0.0%', humidityRaw: 0,
    soil: '0.0%', soilRaw: 0,
    light: '0 lx', lightRaw: 0,
    nitrogen: '0 mg/kg', nitrogenRaw: 0,
    phosphorus: '0 mg/kg', phosphorusRaw: 0,
    potassium: '0 mg/kg', potassiumRaw: 0,
    sampleCount: 0,
  };
}

function average(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Real average of a set of logged readings — no seeded/fabricated fallback.
export function computeDailyAverages(dateStr: string, readings: SensorReadingLog[]): DailyAverages {
  if (!readings.length) return zeroAverages(dateStr);

  const avgTemp = parseFloat(average(readings.map((r) => r.temperature)).toFixed(1));
  const avgHumidity = parseFloat(average(readings.map((r) => r.humidity)).toFixed(1));
  const avgSoil = parseFloat(average(readings.map((r) => r.soilMoisture)).toFixed(1));
  const avgLight = Math.round(average(readings.map((r) => r.lightIntensity)));
  const avgN = Math.round(average(readings.map((r) => r.nitrogen)));
  const avgP = Math.round(average(readings.map((r) => r.phosphorus)));
  const avgK = Math.round(average(readings.map((r) => r.potassium)));

  return {
    dateStr,
    temp: `${avgTemp}°C`, tempRaw: avgTemp,
    humidity: `${avgHumidity}%`, humidityRaw: avgHumidity,
    soil: `${avgSoil}%`, soilRaw: avgSoil,
    light: `${avgLight} lx`, lightRaw: avgLight,
    nitrogen: `${avgN} mg/kg`, nitrogenRaw: avgN,
    phosphorus: `${avgP} mg/kg`, phosphorusRaw: avgP,
    potassium: `${avgK} mg/kg`, potassiumRaw: avgK,
    sampleCount: readings.length,
  };
}

// [start, end) epoch-ms range covering one local calendar date (YYYY-MM-DD).
export function dayRangeMs(dateStr: string): [number, number] {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.getTime(), end.getTime()];
}

// React hook: the REAL daily average for one calendar date, computed from
// actual logged ESP32 readings in Firestore. While loading, or when nothing
// has been logged for that date, it returns an all-zero DailyAverages
// (sampleCount: 0) — never a fabricated/seeded value.
export function useDailyAverages(dateStr: string): { data: DailyAverages; loading: boolean } {
  const [state, setState] = useState<{ data: DailyAverages; loading: boolean }>({
    data: zeroAverages(dateStr),
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: zeroAverages(dateStr), loading: true });

    const load = async () => {
      const [startMs, endMs] = dayRangeMs(dateStr);
      const readings = await fetchReadingsInRange(startMs, endMs);
      if (cancelled) return;
      setState({ data: computeDailyAverages(dateStr, readings), loading: false });
    };

    load();

    // Keep today's card current as new readings arrive; past dates are fixed.
    const todayStr = new Date().toISOString().split('T')[0];
    let interval: ReturnType<typeof setInterval> | null = null;
    if (dateStr === todayStr) {
      interval = setInterval(load, 20000);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [dateStr]);

  return state;
}

export interface ChartPoint {
  time: string;
  temp: number;
  humidity: number;
  soil: number;
  light: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

function bucketAverages(readings: SensorReadingLog[]): Omit<ChartPoint, 'time'> {
  if (!readings.length) {
    return { temp: 0, humidity: 0, soil: 0, light: 0, nitrogen: 0, phosphorus: 0, potassium: 0 };
  }
  return {
    temp: parseFloat(average(readings.map((r) => r.temperature)).toFixed(1)),
    humidity: parseFloat(average(readings.map((r) => r.humidity)).toFixed(1)),
    soil: parseFloat(average(readings.map((r) => r.soilMoisture)).toFixed(1)),
    light: Math.round(average(readings.map((r) => r.lightIntensity))),
    nitrogen: Math.round(average(readings.map((r) => r.nitrogen))),
    phosphorus: Math.round(average(readings.map((r) => r.phosphorus))),
    potassium: Math.round(average(readings.map((r) => r.potassium))),
  };
}

// Groups real readings into `bucketCount` equal-width time windows spanning
// [start, end) and averages each window — buckets with no logged readings
// come back as zero, never interpolated or fabricated.
export function bucketByFixedWindows(
  readings: SensorReadingLog[],
  start: number,
  end: number,
  bucketCount: number,
  labelFn: (bucketStartMs: number, idx: number) => string
): ChartPoint[] {
  const bucketMs = (end - start) / bucketCount;
  const buckets: SensorReadingLog[][] = Array.from({ length: bucketCount }, () => []);
  for (const r of readings) {
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((r.ts - start) / bucketMs)));
    buckets[idx].push(r);
  }
  return buckets.map((b, idx) => ({
    time: labelFn(start + idx * bucketMs, idx),
    ...bucketAverages(b),
  }));
}

// Real, un-bucketed readings mapped to chart/table point shape, in order.
export function readingsToPoints(readings: SensorReadingLog[]): ChartPoint[] {
  return readings
    .slice()
    .sort((a, b) => a.ts - b.ts)
    .map((r) => ({
      time: new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      temp: r.temperature,
      humidity: r.humidity,
      soil: r.soilMoisture,
      light: r.lightIntensity,
      nitrogen: r.nitrogen,
      phosphorus: r.phosphorus,
      potassium: r.potassium,
    }));
}

// React hook: real logged readings within [startMs, endMs). Empty array
// while loading or when nothing has been logged in that range.
export function useReadingsInRange(startMs: number, endMs: number): { readings: SensorReadingLog[]; loading: boolean } {
  const [state, setState] = useState<{ readings: SensorReadingLog[]; loading: boolean }>({ readings: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ readings: [], loading: true });

    const load = async () => {
      const readings = await fetchReadingsInRange(startMs, endMs);
      if (!cancelled) setState({ readings, loading: false });
    };

    load();

    // If this range includes "now", keep it current.
    let interval: ReturnType<typeof setInterval> | null = null;
    if (endMs >= Date.now()) {
      interval = setInterval(load, 20000);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [startMs, endMs]);

  return state;
}
