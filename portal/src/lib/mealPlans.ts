// Lógica pura de planes de alimentación (mismas reglas que la app:
// src/components/nutrition/MealPlan.tsx).

import type { MealPlan, MealPlanDay, MealPlanItem } from './types';

export const DEFAULT_MEALS = ['Desayuno', 'Merienda', 'Almuerzo', 'Snack', 'Cena'];
export const ALL_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DEFAULT_DAYS = ALL_DAYS.slice(0, 5);

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, i) => ({ calories: a.calories + i.calories, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }),
    ZERO
  );
}

export function dayTotals(day: MealPlanDay): Macros {
  return sumMacros(day.meals.map((m) => sumMacros(m.items)));
}

/** Media diaria del plan (redondeada como en el PDF). */
export function planAverages(plan: MealPlan): Macros {
  const n = plan.days.length;
  if (n === 0) return ZERO;
  const t = sumMacros(plan.days.map(dayTotals));
  return {
    calories: Math.round(t.calories / n),
    protein: Math.round(t.protein / n),
    carbs: Math.round(t.carbs / n),
    fat: Math.round(t.fat / n),
  };
}

export function countItems(plan: MealPlan): number {
  return plan.days.reduce((a, d) => a + d.meals.reduce((b, m) => b + m.items.length, 0), 0);
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2, 15);
  }
}

/** Plan vacío con los días elegidos (ordenados lunes→domingo) y las comidas por defecto. */
export function blankPlan(name: string, days: string[]): Omit<MealPlan, 'id'> {
  const ordered = ALL_DAYS.filter((d) => days.includes(d));
  return {
    name: name.trim(),
    days: ordered.map((d) => ({ name: d, meals: DEFAULT_MEALS.map((m) => ({ name: m, items: [] })) })),
  };
}

export interface FoodLike {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portions?: { label: string; grams: number }[];
}

/** Valores por 100 g → ítem del plan (redondeo idéntico a la app). */
export function makeItem(food: FoodLike, grams: number, id: string = newId()): MealPlanItem {
  const g = Math.max(0, grams);
  return {
    id,
    food_id: food.id,
    food_name: food.name,
    grams: g,
    calories: Math.round((food.calories * g) / 100),
    protein: Math.round(((food.protein * g) / 100) * 10) / 10,
    carbs: Math.round(((food.carbs * g) / 100) * 10) / 10,
    fat: Math.round(((food.fat * g) / 100) * 10) / 10,
  };
}

/**
 * Cambia los gramos de un ítem. Si el alimento está en la base se recalcula
 * desde sus valores por 100 g; si no, se escala de forma proporcional.
 */
export function regram(item: MealPlanItem, grams: number, food?: FoodLike | null): MealPlanItem {
  if (food) return makeItem(food, grams, item.id);
  const g = Math.max(0, grams);
  const f = item.grams > 0 ? g / item.grams : 0;
  return {
    ...item,
    grams: g,
    calories: Math.round(item.calories * f),
    protein: Math.round(item.protein * f * 10) / 10,
    carbs: Math.round(item.carbs * f * 10) / 10,
    fat: Math.round(item.fat * f * 10) / 10,
  };
}

/** Copia profunda con ids de ítem nuevos (para duplicar días). */
export function cloneDay(day: MealPlanDay, name: string): MealPlanDay {
  return {
    name,
    meals: day.meals.map((m) => ({ name: m.name, items: m.items.map((i) => ({ ...i, id: newId() })) })),
  };
}

/** Problemas que impiden guardar. */
export function validatePlan(plan: Omit<MealPlan, 'id'>): string | null {
  if (!plan.name.trim()) return 'Ponle un nombre al plan.';
  if (plan.days.length === 0) return 'El plan necesita al menos un día.';
  for (const d of plan.days) {
    for (const m of d.meals) {
      if (!m.name.trim()) return `Hay una comida sin nombre en ${d.name}.`;
      for (const i of m.items) if (!(i.grams > 0)) return `${i.food_name} (${d.name}, ${m.name}) necesita una cantidad mayor que 0.`;
    }
  }
  return null;
}

/** Normaliza texto para búsqueda sin acentos. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
