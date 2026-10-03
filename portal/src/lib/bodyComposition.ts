// src/utils/bodyComposition.ts
//
// Utilidades de composición corporal (masa muscular, grasa visceral,
// metabolismo basal). Los valores suelen venir de una báscula de
// bioimpedancia; el metabolismo basal también puede estimarse.

export type Gender = 'male' | 'female' | 'other' | '' | undefined;

/**
 * Metabolismo basal estimado (Mifflin-St Jeor), en kcal/día.
 * Devuelve null si faltan datos. Para 'other' usa el promedio de ambas fórmulas.
 */
export function estimateBmrKcal(input: {
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  gender?: Gender;
}): number | null {
  const { weightKg, heightCm, age, gender } = input;
  if (!weightKg || !heightCm || !age || weightKg <= 0 || heightCm <= 0 || age <= 0) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const male = base + 5;
  const female = base - 161;
  const bmr = gender === 'male' ? male : gender === 'female' ? female : (male + female) / 2;
  return Math.round(bmr);
}

export type VisceralFatBand = 'healthy' | 'high' | 'very_high';

/** Escala habitual de básculas de bioimpedancia (1–59). */
export function visceralFatBand(level?: number | null): VisceralFatBand | null {
  if (level == null || !Number.isFinite(level) || level <= 0) return null;
  if (level < 10) return 'healthy';
  if (level < 15) return 'high';
  return 'very_high';
}

export const VISCERAL_FAT_LABELS: Record<VisceralFatBand, string> = {
  healthy: 'Saludable',
  high: 'Elevada',
  very_high: 'Muy elevada',
};

export function visceralFatLabel(level?: number | null): string | null {
  const band = visceralFatBand(level);
  return band ? VISCERAL_FAT_LABELS[band] : null;
}

/** "12" → 12; "" / inválido → undefined. Acepta coma decimal. */
export function parseOptionalNumber(value: string | number | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
