// Datos de ejemplo para el modo demo (sin Supabase). Deterministas: mismo
// resultado en cada carga para un `now` dado.

import type { BackupPayload, Client, FoodEntry, Measurement, PersonalRecord, ServicePeriod, SessionSummary } from './types';
import { toISODate, DAY_MS } from './analytics';
import { makeItem, type FoodLike } from './mealPlans';
import type { MealPlan } from './types';

const FOODS: Record<string, FoodLike> = {
  huevo: { id: 'huevo-de-gallina-entero', name: 'Huevo de gallina entero', calories: 149, protein: 12.5, carbs: 0.3, fat: 10.8 },
  banano: { id: 'banano', name: 'Banano', calories: 101, protein: 1.5, carbs: 22.3, fat: 0.1 },
  yogur: { id: 'yogurt-griego-0-grasa', name: 'Yogurt griego 0% grasa', calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  almendras: { id: 'almendras', name: 'Almendras', calories: 639, protein: 18.6, carbs: 13.9, fat: 54.1 },
  pollo: { id: 'pollo-a-la-plancha', name: 'Pollo a la plancha', calories: 175, protein: 28, carbs: 1, fat: 6 },
  arroz: { id: 'arroz-blanco', name: 'Arroz blanco', calories: 170, protein: 3, carbs: 36, fat: 0.5 },
  brocoli: { id: 'brocoli', name: 'Brócoli', calories: 46, protein: 3, carbs: 6.6, fat: 0.3 },
  salmon: { id: 'salmon-filete', name: 'Salmón filete', calories: 181, protein: 20.2, carbs: 0.3, fat: 11 },
  aguacate: { id: 'aguacate', name: 'Aguacate', calories: 221, protein: 1.3, carbs: 13.5, fat: 16.4 },
  manzana: { id: 'manzana', name: 'Manzana', calories: 72, protein: 0.3, carbs: 16.5, fat: 0.2 },
};

function demoPlan(id: string, name: string, days: string[], scale: number): MealPlan {
  let n = 0;
  const it = (k: keyof typeof FOODS, g: number) => makeItem(FOODS[k], Math.round(g * scale), `${id}-i${n++}`);
  return {
    id,
    name,
    days: days.map((d, i) => ({
      name: d,
      meals: [
        { name: 'Desayuno', items: [it('huevo', 110), it('banano', 120)] },
        { name: 'Merienda', items: [it('yogur', 150), it('almendras', 20)] },
        { name: 'Almuerzo', items: i % 2 === 0 ? [it('pollo', 150), it('arroz', 150), it('brocoli', 100)] : [it('salmon', 150), it('arroz', 120), it('aguacate', 50)] },
        { name: 'Snack', items: [it('manzana', 180)] },
        { name: 'Cena', items: i % 2 === 0 ? [it('salmon', 120), it('brocoli', 150)] : [it('pollo', 130), it('aguacate', 50)] },
      ],
    })),
  };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

interface Profile {
  name: string;
  gender: 'male' | 'female';
  age: number;
  height: number;
  weight: number;
  fat: number;
  muscle: number;
  visceral: number;
  days: number;
  /** días desde la última sesión */
  lastGap: number;
  /** tendencia mensual de peso */
  trend: number;
  periodEndOffset: number;
  goal: string;
}

const PROFILES: Profile[] = [
  { name: 'Valentina Ríos', gender: 'female', age: 29, height: 165, weight: 64, fat: 27, muscle: 24.5, visceral: 5, days: 4, lastGap: 1, trend: -0.8, periodEndOffset: 22, goal: 'Definición' },
  { name: 'Andrés Gómez', gender: 'male', age: 34, height: 178, weight: 88, fat: 24, muscle: 35.2, visceral: 11, days: 3, lastGap: 2, trend: -1.2, periodEndOffset: 5, goal: 'Pérdida de grasa' },
  { name: 'Camila Torres', gender: 'female', age: 41, height: 160, weight: 70, fat: 33, muscle: 22.1, visceral: 8, days: 3, lastGap: 12, trend: -0.4, periodEndOffset: -3, goal: 'Salud general' },
  { name: 'Mateo Herrera', gender: 'male', age: 25, height: 182, weight: 74, fat: 14, muscle: 34.8, visceral: 3, days: 5, lastGap: 0, trend: 0.6, periodEndOffset: 40, goal: 'Hipertrofia' },
  { name: 'Lucía Morales', gender: 'female', age: 37, height: 168, weight: 61, fat: 25, muscle: 23.9, visceral: 4, days: 3, lastGap: 30, trend: 0, periodEndOffset: -20, goal: 'Tonificación' },
  { name: 'Sebastián Díaz', gender: 'male', age: 47, height: 175, weight: 96, fat: 29, muscle: 34.0, visceral: 15, days: 2, lastGap: 4, trend: -1.5, periodEndOffset: 12, goal: 'Pérdida de grasa' },
  { name: 'Isabella Castro', gender: 'female', age: 22, height: 170, weight: 58, fat: 21, muscle: 24.8, visceral: 2, days: 4, lastGap: 3, trend: 0.3, periodEndOffset: 2, goal: 'Rendimiento' },
  { name: 'Daniel Vargas', gender: 'male', age: 31, height: 172, weight: 80, fat: 19, muscle: 35.5, visceral: 6, days: 4, lastGap: 9, trend: 0.2, periodEndOffset: 60, goal: 'Fuerza' },
];

function bmr(p: Profile, weight: number): number {
  return Math.round(10 * weight + 6.25 * p.height - 5 * p.age + (p.gender === 'male' ? 5 : -161));
}

export function demoPayload(now: Date = new Date()): BackupPayload {
  const r = rng(42);
  const clients: Client[] = [];
  const measurements: Measurement[] = [];
  const sessions: SessionSummary[] = [];
  const entries: FoodEntry[] = [];
  const periods: ServicePeriod[] = [];
  const targetsByClient: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
  const prs: Record<string, Record<string, PersonalRecord>> = {};
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  PROFILES.forEach((p, i) => {
    const id = `demo-${i + 1}`;
    const months = 6;
    // Mediciones cada ~2 semanas durante 6 meses (más reciente al final del bucle).
    let lastW = p.weight;
    let lastF = p.fat;
    let lastM = p.muscle;
    let lastV = p.visceral;
    const n = 12;
    for (let k = n - 1; k >= 0; k--) {
      const progress = (n - 1 - k) / (n - 1); // 0 → 1
      const w = p.weight - p.trend * months * (1 - progress) + (r() - 0.5) * 0.8;
      const f = p.fat + (p.trend < 0 ? 3 : -0.5) * (1 - progress) + (r() - 0.5) * 0.6;
      const m = p.muscle - (p.trend > 0 ? 1.2 : 0.4) * (1 - progress) + (r() - 0.5) * 0.3;
      const v = Math.max(1, Math.round(p.visceral + (p.trend < 0 ? 2 : 0) * (1 - progress)));
      const date = new Date(today.getTime() - k * 14 * DAY_MS - Math.floor(r() * 3) * DAY_MS);
      lastW = Number(w.toFixed(1));
      lastF = Number(f.toFixed(1));
      lastM = Number(m.toFixed(1));
      lastV = v;
      measurements.push({
        id: `${id}-m${k}`,
        client_id: id,
        measured_at: new Date(date.getTime() + 9 * 3600_000).toISOString(),
        weight_kg: lastW,
        body_fat_pct: lastF,
        muscle_mass_kg: lastM,
        visceral_fat_level: lastV,
        bmr_kcal: bmr(p, lastW),
        waist_cm: Number(((p.gender === 'male' ? 80 : 70) + (lastF - 15) * 0.9).toFixed(1)),
      });
    }

    clients.push({
      id,
      full_name: p.name,
      email: `${p.name.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}@ejemplo.com`,
      created_at: new Date(today.getTime() - 200 * DAY_MS).toISOString(),
      age: p.age,
      gender: p.gender,
      height_cm: p.height,
      weight_kg: lastW,
      target_weight_kg: Math.round(p.weight + (p.trend < 0 ? -6 : 3)),
      body_fat_pct: lastF,
      muscle_mass_kg: lastM,
      visceral_fat_level: lastV,
      bmr_kcal: bmr(p, lastW),
      activity_level: 'moderate',
      goal: p.goal,
      training_experience: i % 3 === 0 ? 'intermediate' : i % 3 === 1 ? 'beginner' : 'advanced',
      training_days_per_week: p.days,
      training_location: 'gym',
      phone: `+57 300 ${String(1000000 + i * 137531).slice(0, 7)}`,
    });

    // Sesiones: últimas 16 semanas, con la última sesión a `lastGap` días.
    const lastDay = new Date(today.getTime() - p.lastGap * DAY_MS);
    for (let w = 0; w < 16; w++) {
      const perWeek = Math.max(0, p.days - (r() < 0.35 ? 1 : 0) - (w > 10 && p.lastGap > 20 ? p.days : 0));
      for (let s = 0; s < perWeek; s++) {
        const d = new Date(lastDay.getTime() - (w * 7 + Math.floor((s * 7) / Math.max(perWeek, 1))) * DAY_MS);
        if (w === 0 && s === 0) d.setTime(lastDay.getTime());
        const vol = Math.round((p.gender === 'male' ? 9000 : 5500) * (0.8 + r() * 0.4) * (1 + (16 - w) * 0.01));
        sessions.push({
          id: `${id}-s${w}-${s}`,
          client_id: id,
          date: toISODate(d),
          duration_minutes: 45 + Math.round(r() * 30),
          total_sets: 16 + Math.round(r() * 8),
          total_volume: vol,
          avg_rpe: Number((6.5 + r() * 2).toFixed(1)),
          prs_achieved: r() < 0.15 ? 1 : 0,
        });
      }
    }

    const kcal = Math.round((bmr(p, lastW) * 1.55 + (p.trend < 0 ? -400 : 250)) / 10) * 10;
    targetsByClient[id] = { calories: kcal, protein: Math.round(lastW * 2), carbs: Math.round((kcal * 0.45) / 4), fat: Math.round((kcal * 0.25) / 9) };
    for (let dd = 0; dd < 14; dd++) {
      if (r() < (i % 2 === 0 ? 0.15 : 0.45)) continue;
      const d = new Date(today.getTime() - dd * DAY_MS);
      const total = kcal * (0.85 + r() * 0.3);
      ['breakfast', 'lunch', 'dinner'].forEach((meal, mi) => {
        const share = [0.3, 0.4, 0.3][mi];
        entries.push({
          id: `${id}-f${dd}-${mi}`,
          client_id: id,
          date: toISODate(d),
          meal,
          food_name: ['Avena con fruta', 'Pollo con arroz', 'Salmón con verduras'][mi],
          grams: 300,
          calories: Math.round(total * share),
          protein: Math.round((lastW * 2 * share) * (0.8 + r() * 0.4)),
          carbs: Math.round(((total * 0.45) / 4) * share),
          fat: Math.round(((total * 0.25) / 9) * share),
        });
      });
    }

    const end = new Date(today.getTime() + p.periodEndOffset * DAY_MS);
    const start = new Date(end.getTime() - 30 * DAY_MS);
    periods.push({
      id: `${id}-p1`,
      client_id: id,
      plan_name: i % 2 === 0 ? 'Mensual · 3 sesiones/sem' : 'Mensual · online',
      start_date: toISODate(start),
      end_date: toISODate(end),
      price: i % 2 === 0 ? 180000 : 120000,
      paid: p.periodEndOffset > 0 || i % 3 === 0,
      created_at: start.toISOString(),
    });

    prs[id] = {
      bench: { exerciseId: 'bench', exerciseName: 'Press banca', weight: Math.round(lastW * (p.gender === 'male' ? 1.1 : 0.6)), reps: 5, e1rm: Math.round(lastW * (p.gender === 'male' ? 1.25 : 0.7)), date: toISODate(new Date(today.getTime() - 9 * DAY_MS)) },
      squat: { exerciseId: 'squat', exerciseName: 'Sentadilla', weight: Math.round(lastW * (p.gender === 'male' ? 1.4 : 1.0)), reps: 5, e1rm: Math.round(lastW * (p.gender === 'male' ? 1.6 : 1.15)), date: toISODate(new Date(today.getTime() - 20 * DAY_MS)) },
      deadlift: { exerciseId: 'deadlift', exerciseName: 'Peso muerto', weight: Math.round(lastW * (p.gender === 'male' ? 1.7 : 1.2)), reps: 3, e1rm: Math.round(lastW * (p.gender === 'male' ? 1.85 : 1.3)), date: toISODate(new Date(today.getTime() - 35 * DAY_MS)) },
    };
  });

  return {
    version: 1,
    clients,
    measurements: measurements.reverse(),
    sessions: sessions.sort((a, b) => b.date.localeCompare(a.date)),
    nutrition: {
      entries,
      targetsByClient,
      mealPlans: [
        demoPlan('plan-1', 'Definición · Fase 1', ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'], 1),
        demoPlan('plan-2', 'Volumen limpio', ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'], 1.35),
      ],
      assignedPlanIds: { 'demo-1': 'plan-1', 'demo-2': 'plan-1', 'demo-4': 'plan-2' },
    },
    checkins: [],
    prs,
    periods,
  };
}
