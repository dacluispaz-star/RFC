// Normaliza la copia en la nube y superpone los cambios del portal que el
// teléfono aún no ha incorporado. Misma semántica que la app
// (src/utils/portalChanges.ts): upsert = fusionar campos / crear; delete.

import type { BackupPayload, Client, MealPlan, Measurement, PortalChange, PortalData } from './types';

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string') as T[]) : [];
}

function rec<T>(v: unknown): Record<string, T> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {};
}

function t(d?: string): number {
  const n = d ? Date.parse(d) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function buildPortalData(
  payload: BackupPayload | null,
  pending: PortalChange[],
  backupUpdatedAt: string | null
): PortalData {
  const p = payload ?? { version: 1 };
  let clients = arr<Client>(p.clients).map((c) => ({ ...c }));
  let measurements = arr<Measurement>(p.measurements).map((m) => ({ ...m }));
  const n = rec<unknown>(p.nutrition);
  let mealPlans = arr<MealPlan>(n.mealPlans).filter((pl) => Array.isArray(pl.days));
  let assignedPlanIds = { ...rec<string>(n.assignedPlanIds) };

  const ordered = [...pending].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const ch of ordered) {
    const id = ch.record_id;
    if (ch.entity === 'client') {
      if (ch.op === 'upsert' && ch.record) {
        const i = clients.findIndex((c) => c.id === id);
        if (i >= 0) clients[i] = { ...clients[i], ...(ch.record as Partial<Client>), id };
        else if (typeof ch.record.full_name === 'string') {
          clients.push({ email: '', created_at: ch.created_at, ...(ch.record as Partial<Client>), id } as Client);
        }
      } else if (ch.op === 'delete') {
        clients = clients.filter((c) => c.id !== id);
        measurements = measurements.filter((m) => m.client_id !== id);
      }
    } else if (ch.entity === 'measurement') {
      if (ch.op === 'upsert' && ch.record) {
        const i = measurements.findIndex((m) => m.id === id);
        if (i >= 0) measurements[i] = { ...measurements[i], ...(ch.record as Partial<Measurement>), id };
        else if (typeof ch.record.client_id === 'string' && typeof ch.record.measured_at === 'string') {
          measurements.push({ ...(ch.record as Partial<Measurement>), id } as Measurement);
        }
      } else if (ch.op === 'delete') {
        measurements = measurements.filter((m) => m.id !== id);
      }
    } else if (ch.entity === 'meal_plan') {
      // Un plan viaja completo: upsert = reemplazo íntegro.
      if (ch.op === 'upsert' && ch.record && typeof ch.record.name === 'string' && Array.isArray(ch.record.days)) {
        const next = { ...(ch.record as unknown as Omit<MealPlan, 'id'>), id } as MealPlan;
        const i = mealPlans.findIndex((pl) => pl.id === id);
        if (i >= 0) mealPlans[i] = { ...next, client_id: next.client_id ?? mealPlans[i].client_id };
        else mealPlans.push(next);
      } else if (ch.op === 'delete') {
        mealPlans = mealPlans.filter((pl) => pl.id !== id);
        assignedPlanIds = Object.fromEntries(Object.entries(assignedPlanIds).filter(([, pid]) => pid !== id));
      }
    }
  }

  measurements.sort((a, b) => t(b.measured_at) - t(a.measured_at));
  clients.sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'));

  return {
    clients,
    measurements,
    sessions: arr(p.sessions),
    foodEntries: arr(n.entries),
    targetsByClient: rec(n.targetsByClient),
    mealPlans,
    assignedPlanIds,
    checkins: arr(p.checkins),
    prs: rec(p.prs),
    periods: arr(p.periods),
    backupUpdatedAt,
    pendingCount: pending.length,
  };
}
