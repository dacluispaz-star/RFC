import { describe, it, expect } from 'vitest';
import { activityStatus, adherence, currentPeriod, dashboardStats, metricChange, metricSeries, nutritionAdherence, nutritionDays, periodStatus, recentChange, summarizeClient, weeklyBuckets } from '@/lib/analytics';
import { buildPortalData } from '@/lib/overlay';
import { niceScale } from '@/components/charts';
import type { BackupPayload, PortalChange } from '@/lib/types';

const NOW = new Date(2026, 9, 3, 12); // sáb 3 oct 2026

const payload: BackupPayload = {
  version: 1,
  clients: [
    { id: 'a', full_name: 'Ana', email: '', created_at: '2026-01-01', training_days_per_week: 3 },
    { id: 'b', full_name: 'Beto', email: '', created_at: '2026-01-01', weight_kg: 90 },
  ],
  measurements: [
    { id: 'm1', client_id: 'a', measured_at: '2026-09-01T10:00:00Z', weight_kg: 62, body_fat_pct: 25, muscle_mass_kg: 24 },
    { id: 'm2', client_id: 'a', measured_at: '2026-10-01T10:00:00Z', weight_kg: 60.5, body_fat_pct: 24, muscle_mass_kg: 24.6, visceral_fat_level: 5 },
  ],
  sessions: [
    { id: 's1', client_id: 'a', date: '2026-10-02', duration_minutes: 60, total_sets: 20, total_volume: 5000, avg_rpe: 7, prs_achieved: 1 },
    { id: 's2', client_id: 'a', date: '2026-09-28', duration_minutes: 60, total_sets: 20, total_volume: 5000, avg_rpe: 7, prs_achieved: 0 },
    { id: 's3', client_id: 'a', date: '2026-09-15', duration_minutes: 60, total_sets: 20, total_volume: 5000, avg_rpe: 7, prs_achieved: 0 },
    { id: 's4', client_id: 'b', date: '2026-08-20', duration_minutes: 60, total_sets: 20, total_volume: 8000, avg_rpe: 8, prs_achieved: 0 },
  ],
  nutrition: {
    entries: [
      { id: 'f1', client_id: 'a', date: '2026-10-03', meal: 'lunch', food_name: 'x', grams: 1, calories: 1900, protein: 120, carbs: 1, fat: 1 },
      { id: 'f2', client_id: 'a', date: '2026-10-01', meal: 'lunch', food_name: 'x', grams: 1, calories: 1500, protein: 90, carbs: 1, fat: 1 },
    ],
    targetsByClient: { a: { calories: 2000, protein: 120, carbs: 200, fat: 60 } },
  },
  periods: [
    { id: 'p1', client_id: 'a', plan_name: 'Mensual', start_date: '2026-09-08', end_date: '2026-10-07', paid: true, created_at: '' },
    { id: 'p0', client_id: 'a', plan_name: 'Mensual', start_date: '2026-08-08', end_date: '2026-09-07', paid: true, created_at: '' },
    { id: 'p2', client_id: 'b', plan_name: 'Online', start_date: '2026-08-01', end_date: '2026-09-30', paid: false, created_at: '' },
  ],
};

describe('overlay de cambios del portal', () => {
  it('superpone altas y ediciones pendientes y borra medidas', () => {
    const pending: PortalChange[] = [
      { id: '1', entity: 'client', op: 'upsert', record_id: 'a', record: { weight_kg: 59 }, created_at: '2026-10-03T08:00:00Z' },
      { id: '2', entity: 'client', op: 'upsert', record_id: 'c', record: { full_name: 'Caro' }, created_at: '2026-10-03T08:01:00Z' },
      { id: '3', entity: 'measurement', op: 'delete', record_id: 'm1', record: null, created_at: '2026-10-03T08:02:00Z' },
      { id: '4', entity: 'measurement', op: 'upsert', record_id: 'm3', record: { client_id: 'a', measured_at: '2026-10-03T09:00:00Z', weight_kg: 60 }, created_at: '2026-10-03T08:03:00Z' },
    ];
    const d = buildPortalData(payload, pending, '2026-10-02T00:00:00Z');
    expect(d.clients.map((c) => c.full_name)).toEqual(['Ana', 'Beto', 'Caro']);
    expect(d.clients[0].weight_kg).toBe(59);
    expect(d.measurements.map((m) => m.id)).toEqual(['m3', 'm2']);
    expect(d.pendingCount).toBe(4);
  });

  it('tolera una copia vacía o corrupta', () => {
    const d = buildPortalData({ version: 1, clients: 'x' as never, measurements: [null as never] }, [], null);
    expect(d.clients).toEqual([]);
    expect(d.measurements).toEqual([]);
  });
});

describe('analítica', () => {
  const data = buildPortalData(payload, [], null);

  it('estado de actividad por días sin entrenar', () => {
    expect(activityStatus(null)).toBe('never');
    expect(activityStatus(3)).toBe('active');
    expect(activityStatus(14)).toBe('at_risk');
    expect(activityStatus(30)).toBe('inactive');
  });

  it('resumen de cliente', () => {
    const s = summarizeClient(data, data.clients[0], NOW);
    expect(s.lastSession).toBe('2026-10-02');
    expect(s.daysSinceLast).toBe(1);
    expect(s.activity).toBe('active');
    expect(s.sessions30d).toBe(3);
    expect(s.weight).toBe(60.5);
    expect(s.visceral).toBe(5);
    expect(s.period?.id).toBe('p1');
    expect(s.periodStatus).toBe('expiring');
    expect(s.periodDaysLeft).toBe(4);
    const b = summarizeClient(data, data.clients[1], NOW);
    expect(b.weight).toBe(90); // del perfil, sin mediciones
    expect(b.activity).toBe('inactive');
    expect(b.periodStatus).toBe('expired');
  });

  it('adherencia: sesiones de 4 semanas / (días × 4)', () => {
    expect(adherence(data.sessions, data.clients[0], NOW)).toBeCloseTo(3 / 12);
    expect(adherence(data.sessions, data.clients[1], NOW)).toBeNull();
  });

  it('cambios de composición', () => {
    const ms = data.measurements.filter((m) => m.client_id === 'a');
    expect(metricSeries(ms, 'weight_kg').map((p) => p.value)).toEqual([62, 60.5]);
    expect(metricChange(ms, 'weight_kg')?.delta).toBeCloseTo(-1.5);
    expect(recentChange(ms, 'muscle_mass_kg')).toBeCloseTo(0.6);
    expect(metricChange(ms, 'visceral_fat_level')).toBeNull();
  });

  it('semanas, panel y nutrición', () => {
    const w = weeklyBuckets(data.sessions, NOW, 4);
    expect(w).toHaveLength(4);
    expect(w[3].week).toBe('2026-09-28');
    expect(w[3].sessions).toBe(2);
    const summaries = data.clients.map((c) => summarizeClient(data, c, NOW));
    const st = dashboardStats(summaries, data.sessions, NOW);
    expect(st).toMatchObject({ totalClients: 2, activeClients: 1, inactiveClients: 1, sessions30d: 3, expiring: 1, expired: 1 });
    const days = nutritionDays(data, 'a', NOW, 14);
    expect(days).toHaveLength(14);
    expect(nutritionAdherence(days, 2000)).toEqual({ logged: 2, onTarget: 1 });
  });

  it('período vigente y estados', () => {
    expect(currentPeriod(payload.periods!, 'a', NOW)?.id).toBe('p1');
    expect(periodStatus(null, NOW)).toBe('none');
  });
});

describe('niceScale', () => {
  it('genera ticks redondos que cubren el rango', () => {
    const s = niceScale(86.1, 97.4, 4);
    expect(s.domain[0]).toBeLessThanOrEqual(86.1);
    expect(s.domain[1]).toBeGreaterThanOrEqual(97.4);
    expect(s.ticks.every((t) => Number.isInteger(t * 2))).toBe(true);
    expect(niceScale(0, 3011, 5).ticks).toEqual([0, 1000, 2000, 3000, 4000]);
  });
});
