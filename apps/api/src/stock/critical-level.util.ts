import type { Confidence } from '@repo/shared-types';

/**
 * Toplantıda kararlaştırılan formül:
 * ADC = 0.6 * ADC_7d + 0.4 * ADC_30d
 * suggested = ADC * (leadTimeDays + safetyMarginDays) [+ trend tamponu]
 */
export function calculateSuggestedCriticalLevel(params: {
  outLast7d: number;
  outLast30d: number;
  leadTimeDays: number;
  safetyMarginDays: number;
  weeklyTrendSlope: number; // pozitifse tüketim artıyor
  trendBufferDays?: number;
}): {
  avgDailyConsumption7d: number;
  avgDailyConsumption30d: number;
  suggestedCriticalLevel: number;
} {
  const {
    outLast7d,
    outLast30d,
    leadTimeDays,
    safetyMarginDays,
    weeklyTrendSlope,
    trendBufferDays = 2,
  } = params;

  const adc7 = outLast7d / 7;
  const adc30 = outLast30d / 30;
  const adc = 0.6 * adc7 + 0.4 * adc30;

  const base = adc * (leadTimeDays + safetyMarginDays);
  const trendBuffer = weeklyTrendSlope > 0 ? adc * trendBufferDays : 0;

  return {
    avgDailyConsumption7d: round2(adc7),
    avgDailyConsumption30d: round2(adc30),
    suggestedCriticalLevel: Math.ceil(base + trendBuffer),
  };
}

export function calculateConfidence(daysOfHistory: number): Confidence {
  if (daysOfHistory >= 30) return 'HIGH';
  if (daysOfHistory >= 14) return 'MEDIUM';
  return 'LOW';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
