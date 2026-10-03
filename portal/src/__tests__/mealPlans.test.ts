import { describe, it, expect } from 'vitest';
import { blankPlan, cloneDay, makeItem, planAverages, regram, validatePlan } from '@/lib/mealPlans';
import { buildPortalData } from '@/lib/overlay';
import { planPdfFilename } from '@/lib/pdfDownload';
import type { BackupPayload, MealPlan, PortalChange } from '@/lib/types';

const AVENA = { id: 'avena', name: 'Avena', calories: 411, protein: 16.9, carbs: 64.1, fat: 7.5 };

describe('planes de alimentación', () => {
  it('calcula macros igual que la app (por 100 g, 1 decimal)', () => {
    expect(makeItem(AVENA, 40, 'x')).toEqual({ id: 'x', food_id: 'avena', food_name: 'Avena', grams: 40, calories: 164, protein: 6.8, carbs: 25.6, fat: 3 });
  });

  it('recalcula al cambiar gramos: desde la base o proporcional', () => {
    const it0 = makeItem(AVENA, 40, 'x');
    expect(regram(it0, 80, AVENA)).toMatchObject({ id: 'x', grams: 80, calories: 329 });
    expect(regram(it0, 80, null)).toMatchObject({ id: 'x', grams: 80, calories: 328, protein: 13.6 });
  });

  it('plan en blanco ordena días y usa las comidas por defecto', () => {
    const p = blankPlan('  Test ', ['Viernes', 'Lunes']);
    expect(p.name).toBe('Test');
    expect(p.days.map((d) => d.name)).toEqual(['Lunes', 'Viernes']);
    expect(p.days[0].meals.map((m) => m.name)).toEqual(['Desayuno', 'Merienda', 'Almuerzo', 'Snack', 'Cena']);
  });

  it('medias diarias y validación', () => {
    const p = blankPlan('A', ['Lunes', 'Martes']);
    p.days[0].meals[0].items.push(makeItem(AVENA, 100));
    expect(planAverages({ ...p, id: '1' })).toEqual({ calories: 206, protein: 8, carbs: 32, fat: 4 });
    expect(validatePlan(p)).toBeNull();
    expect(validatePlan({ ...p, name: ' ' })).toMatch(/nombre/);
    expect(validatePlan({ ...p, days: [] })).toMatch(/al menos un día/);
    const copy = cloneDay(p.days[0], 'Martes');
    expect(copy.meals[0].items[0].id).not.toBe(p.days[0].meals[0].items[0].id);
  });

  it('superpone planes pendientes: crear, reemplazar y borrar (con asignaciones)', () => {
    const plan: MealPlan = { id: 'p1', name: 'Viejo', client_id: 'c1', days: [] };
    const payload: BackupPayload = { version: 1, nutrition: { mealPlans: [plan], assignedPlanIds: { c1: 'p1' } } };
    const ch = (o: Partial<PortalChange>): PortalChange => ({ id: 'x', entity: 'meal_plan', op: 'upsert', record_id: 'p1', record: null, created_at: '2026-10-01T00:00:00Z', ...o });
    let d = buildPortalData(payload, [ch({ record: { name: 'Nuevo', days: [{ name: 'Lunes', meals: [] }] } }), ch({ id: 'y', record_id: 'p2', record: { name: 'Otro', days: [] } })], null);
    expect(d.mealPlans.map((p) => [p.id, p.name, p.client_id])).toEqual([['p1', 'Nuevo', 'c1'], ['p2', 'Otro', undefined]]);
    d = buildPortalData(payload, [ch({ op: 'delete' })], null);
    expect(d.mealPlans).toEqual([]);
    expect(d.assignedPlanIds).toEqual({});
  });

  it('nombre del PDF sin acentos ni símbolos', () => {
    expect(planPdfFilename('Definición · Fase 1', new Date(2026, 9, 3))).toBe('Plan-Definicion Fase 1-2026-10-03.pdf');
  });
});
