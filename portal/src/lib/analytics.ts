// Cálculos analíticos puros (sin React). Todo recibe `now` para ser
// determinista en tests.

import type { Client, Measurement, PortalData, ServicePeriod, SessionSummary } from './types';

export const DAY_MS = 86_400_000;

/* ------------------------------ fechas ------------------------------ */

/** 'yyyy-mm-dd' o ISO completo → Date local. */
export function parseDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Lunes de la semana de `d`. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7; // lunes = 0
  s.setDate(s.getDate() - dow);
  return s;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* --------------------------- servicio ------------------------------- */

export type PeriodStatus = 'active' | 'expiring' | 'expired' | 'none';

export function periodStatus(p: ServicePeriod | null, now: Date): PeriodStatus {
  if (!p) return 'none';
  const days = daysBetween(now, parseDate(p.end_date));
  if (days < 0) return 'expired';
  if (days <= 7) return 'expiring';
  return 'active';
}

/** Período vigente (el que contiene hoy) o, si no, el de fin más reciente. */
export function currentPeriod(periods: ServicePeriod[], clientId: string, now: Date): ServicePeriod | null {
  const mine = periods.filter((p) => p.client_id === clientId);
  if (mine.length === 0) return null;
  const today = toISODate(now);
  const running = mine.filter((p) => p.start_date <= today && p.end_date >= today);
  const pool = running.length > 0 ? running : mine;
  return [...pool].sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
}

/* --------------------------- actividad ------------------------------ */

export type ActivityStatus = 'active' | 'at_risk' | 'inactive' | 'never';

export function activityStatus(daysSinceLast: number | null): ActivityStatus {
  if (daysSinceLast === null) return 'never';
  if (daysSinceLast <= 7) return 'active';
  if (daysSinceLast <= 21) return 'at_risk';
  return 'inactive';
}

export function sessionsOf(sessions: SessionSummary[], clientId?: string): SessionSummary[] {
  return clientId ? sessions.filter((s) => s.client_id === clientId) : sessions;
}

export function countInRange(sessions: SessionSummary[], from: Date, to: Date): number {
  const a = from.getTime();
  const b = to.getTime();
  return sessions.filter((s) => {
    const x = parseDate(s.date).getTime();
    return x >= a && x < b;
  }).length;
}

export interface WeekBucket {
  /** Lunes de la semana, yyyy-mm-dd */
  week: string;
  label: string;
  sessions: number;
  volume: number;
}

/** Sesiones y volumen por semana (lunes a domingo), últimas `weeks` semanas incluida la actual. */
export function weeklyBuckets(sessions: SessionSummary[], now: Date, weeks = 12): WeekBucket[] {
  const thisWeek = startOfWeek(now);
  const out: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const inWeek = sessions.filter((s) => {
      const x = parseDate(s.date).getTime();
      return x >= start.getTime() && x < end.getTime();
    });
    out.push({
      week: toISODate(start),
      label: start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      sessions: inWeek.length,
      volume: Math.round(inWeek.reduce((a, s) => a + (s.total_volume || 0), 0)),
    });
  }
  return out;
}

/**
 * Adherencia de las últimas 4 semanas: sesiones / (días objetivo × 4).
 * null si el cliente no tiene días por semana definidos.
 */
export function adherence(sessions: SessionSummary[], client: Client, now: Date): number | null {
  const target = client.training_days_per_week;
  if (!target || target <= 0) return null;
  const from = new Date(startOfDay(now).getTime() - 27 * DAY_MS);
  const to = new Date(startOfDay(now).getTime() + DAY_MS);
  const done = countInRange(sessionsOf(sessions, client.id), from, to);
  return Math.min(1, done / (target * 4));
}

/* ------------------------- composición ----------------------------- */

export const COMPOSITION_METRICS = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', decimals: 1, betterWhen: 'context' },
  { key: 'body_fat_pct', label: '% Grasa', unit: '%', decimals: 1, betterWhen: 'lower' },
  { key: 'muscle_mass_kg', label: 'Masa muscular', unit: 'kg', decimals: 1, betterWhen: 'higher' },
  { key: 'visceral_fat_level', label: 'Grasa visceral', unit: 'nivel', decimals: 0, betterWhen: 'lower' },
  { key: 'bmr_kcal', label: 'Metabolismo basal', unit: 'kcal', decimals: 0, betterWhen: 'context' },
] as const;

export type CompositionKey = (typeof COMPOSITION_METRICS)[number]['key'];

export function measurementsOf(measurements: Measurement[], clientId: string): Measurement[] {
  // Más reciente primero.
  return measurements
    .filter((m) => m.client_id === clientId)
    .sort((a, b) => parseDate(b.measured_at).getTime() - parseDate(a.measured_at).getTime());
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Último valor medido de una métrica (o el del perfil si nunca se midió). */
export function latestValue(client: Client, ms: Measurement[], key: CompositionKey): number | null {
  for (const m of ms) {
    const v = num(m[key]);
    if (v !== null) return v;
  }
  return num(client[key]);
}

/** Serie temporal (más antiguo primero) de una métrica. */
export function metricSeries(ms: Measurement[], key: CompositionKey): { date: string; value: number }[] {
  return [...ms]
    .reverse()
    .map((m) => ({ date: m.measured_at, value: num(m[key]) }))
    .filter((p): p is { date: string; value: number } => p.value !== null);
}

/** Cambio entre la primera y la última medición con dato (null si < 2). */
export function metricChange(ms: Measurement[], key: CompositionKey): { first: number; last: number; delta: number } | null {
  const s = metricSeries(ms, key);
  if (s.length < 2) return null;
  const first = s[0].value;
  const last = s[s.length - 1].value;
  return { first, last, delta: last - first };
}

/* --------------------------- nutrición ----------------------------- */

export interface NutritionDay {
  date: string;
  label: string;
  calories: number;
  protein: number;
  logged: boolean;
}

export function nutritionDays(data: PortalData, clientId: string, now: Date, days = 14): NutritionDay[] {
  const entries = data.foodEntries.filter((e) => e.client_id === clientId);
  const out: NutritionDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(startOfDay(now).getTime() - i * DAY_MS);
    const iso = toISODate(d);
    const day = entries.filter((e) => (e.date || '').slice(0, 10) === iso);
    out.push({
      date: iso,
      label: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      calories: Math.round(day.reduce((a, e) => a + (e.calories || 0), 0)),
      protein: Math.round(day.reduce((a, e) => a + (e.protein || 0), 0)),
      logged: day.length > 0,
    });
  }
  return out;
}

/** Días registrados dentro de ±10 % del objetivo calórico. */
export function nutritionAdherence(days: NutritionDay[], targetKcal?: number): { logged: number; onTarget: number } {
  const logged = days.filter((d) => d.logged);
  if (!targetKcal) return { logged: logged.length, onTarget: 0 };
  const onTarget = logged.filter((d) => Math.abs(d.calories - targetKcal) <= targetKcal * 0.1).length;
  return { logged: logged.length, onTarget };
}

/* ----------------------------- resumen ----------------------------- */

export interface ClientSummary {
  client: Client;
  lastSession: string | null;
  daysSinceLast: number | null;
  activity: ActivityStatus;
  sessions30d: number;
  adherence: number | null;
  weight: number | null;
  bodyFat: number | null;
  muscle: number | null;
  visceral: number | null;
  bmr: number | null;
  measurementsCount: number;
  lastMeasurement: string | null;
  period: ServicePeriod | null;
  periodStatus: PeriodStatus;
  periodDaysLeft: number | null;
}

export function summarizeClient(data: PortalData, client: Client, now: Date): ClientSummary {
  const ss = sessionsOf(data.sessions, client.id).sort((a, b) => b.date.localeCompare(a.date));
  const last = ss[0]?.date ?? null;
  const daysSinceLast = last ? Math.max(0, daysBetween(parseDate(last), now)) : null;
  const ms = measurementsOf(data.measurements, client.id);
  const period = currentPeriod(data.periods, client.id, now);
  return {
    client,
    lastSession: last,
    daysSinceLast,
    activity: activityStatus(daysSinceLast),
    sessions30d: countInRange(ss, new Date(startOfDay(now).getTime() - 29 * DAY_MS), new Date(startOfDay(now).getTime() + DAY_MS)),
    adherence: adherence(data.sessions, client, now),
    weight: latestValue(client, ms, 'weight_kg'),
    bodyFat: latestValue(client, ms, 'body_fat_pct'),
    muscle: latestValue(client, ms, 'muscle_mass_kg'),
    visceral: latestValue(client, ms, 'visceral_fat_level'),
    bmr: latestValue(client, ms, 'bmr_kcal'),
    measurementsCount: ms.length,
    lastMeasurement: ms[0]?.measured_at ?? null,
    period,
    periodStatus: periodStatus(period, now),
    periodDaysLeft: period ? daysBetween(now, parseDate(period.end_date)) : null,
  };
}

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  atRiskClients: number;
  inactiveClients: number;
  sessions30d: number;
  sessionsPrev30d: number;
  avgAdherence: number | null;
  expiring: number;
  expired: number;
}

export function dashboardStats(summaries: ClientSummary[], sessions: SessionSummary[], now: Date): DashboardStats {
  const today = startOfDay(now).getTime();
  const s30 = countInRange(sessions, new Date(today - 29 * DAY_MS), new Date(today + DAY_MS));
  const sPrev = countInRange(sessions, new Date(today - 59 * DAY_MS), new Date(today - 29 * DAY_MS));
  const adh = summaries.map((s) => s.adherence).filter((a): a is number => a !== null);
  return {
    totalClients: summaries.length,
    activeClients: summaries.filter((s) => s.activity === 'active').length,
    atRiskClients: summaries.filter((s) => s.activity === 'at_risk').length,
    inactiveClients: summaries.filter((s) => s.activity === 'inactive' || s.activity === 'never').length,
    sessions30d: s30,
    sessionsPrev30d: sPrev,
    avgAdherence: adh.length > 0 ? adh.reduce((a, b) => a + b, 0) / adh.length : null,
    expiring: summaries.filter((s) => s.periodStatus === 'expiring').length,
    expired: summaries.filter((s) => s.periodStatus === 'expired').length,
  };
}

/** Cambio entre las dos últimas mediciones (para la tabla del panel). */
export function recentChange(ms: Measurement[], key: CompositionKey): number | null {
  const withValue = ms.filter((m) => num(m[key]) !== null);
  if (withValue.length < 2) return null;
  return (num(withValue[0][key]) as number) - (num(withValue[1][key]) as number);
}
