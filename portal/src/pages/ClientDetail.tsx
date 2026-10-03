import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import {
  COMPOSITION_METRICS,
  measurementsOf,
  metricChange,
  metricSeries,
  nutritionAdherence,
  nutritionDays,
  periodStatus,
  daysBetween,
  parseDate,
  sessionsOf,
  summarizeClient,
  weeklyBuckets,
} from '@/lib/analytics';
import { fmtDate, fmtNum, fmtPct, relativeDays } from '@/lib/format';
import { hrefFor } from '@/lib/router';
import { visceralFatLabel } from '@/lib/bodyComposition';
import type { Client, Measurement } from '@/lib/types';
import { Avatar, Button, Card, EmptyState, StatTile, Tabs } from '@/components/ui';
import { ActivityBadge, Delta, PeriodBadge } from '@/components/status';
import { BarsChart, TrendChart } from '@/components/charts';
import { ClientFormDialog } from '@/components/ClientFormDialog';
import { MeasurementDialog } from '@/components/MeasurementDialog';
import { IconChevronLeft, IconEdit, IconPlus } from '@/components/icons';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'composicion', label: 'Composición corporal' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'nutricion', label: 'Nutrición' },
  { id: 'servicio', label: 'Servicio' },
];

const LABELS: Record<string, Record<string, string>> = {
  gender: { male: 'Hombre', female: 'Mujer', other: 'Otro' },
  activity_level: { sedentary: 'Sedentario', light: 'Ligeramente activo', moderate: 'Moderado', active: 'Activo', very_active: 'Muy activo' },
  training_experience: { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' },
  training_location: { gym: 'Gimnasio', home: 'Casa', outdoors: 'Exterior', mixed: 'Mixto' },
};

export function ClientDetailPage({ id, tab }: { id: string; tab: string }) {
  const { data } = useData();
  const now = useMemo(() => new Date(), []);
  const [editing, setEditing] = useState(false);
  const client = data?.clients.find((c) => c.id === id) ?? null;
  const summary = useMemo(() => (data && client ? summarizeClient(data, client, now) : null), [data, client, now]);

  if (!data) return null;
  if (!client || !summary) {
    return (
      <Card>
        <EmptyState title="Cliente no encontrado" action={<a href={hrefFor({ name: 'clients' })} className="text-sm font-medium text-accent-strong underline underline-offset-4">Volver a clientes</a>}>
          Puede que se haya eliminado desde la app.
        </EmptyState>
      </Card>
    );
  }

  const current = TABS.some((t) => t.id === tab) ? tab : 'resumen';

  return (
    <div className="space-y-6">
      <a href={hrefFor({ name: 'clients' })} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <IconChevronLeft size={16} /> Clientes
      </a>
      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={client.full_name} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-ink truncate">{client.full_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {client.goal && <span>{client.goal}</span>}
            {client.age && <span>· {client.age} años</span>}
            <ActivityBadge status={summary.activity} />
            <PeriodBadge status={summary.periodStatus} daysLeft={summary.periodDaysLeft} />
          </div>
        </div>
        <Button onClick={() => setEditing(true)}>
          <IconEdit size={16} /> Editar datos
        </Button>
      </header>

      <Tabs tabs={TABS} current={current} hrefFor={(t) => hrefFor({ name: 'client', id: client.id, tab: t })} />

      {current === 'resumen' && <SummaryTab client={client} />}
      {current === 'composicion' && <CompositionTab client={client} />}
      {current === 'actividad' && <ActivityTab client={client} now={now} />}
      {current === 'nutricion' && <NutritionTab client={client} now={now} />}
      {current === 'servicio' && <ServiceTab client={client} now={now} />}

      <ClientFormDialog open={editing} onClose={() => setEditing(false)} client={client} />
    </div>
  );
}

/* ------------------------------ Resumen ------------------------------ */

function SummaryTab({ client }: { client: Client }) {
  const { data } = useData();
  const now = useMemo(() => new Date(), []);
  const s = useMemo(() => summarizeClient(data!, client, now), [data, client, now]);
  const ms = measurementsOf(data!.measurements, client.id);
  const target = client.target_weight_kg;
  const imc = s.weight && client.height_cm ? s.weight / Math.pow(client.height_cm / 100, 2) : null;

  const rows: [string, string | undefined][] = [
    ['Correo', client.email || undefined],
    ['Teléfono', client.phone],
    ['Sexo', client.gender ? LABELS.gender[client.gender] : undefined],
    ['Altura', client.height_cm ? `${client.height_cm} cm` : undefined],
    ['Peso objetivo', target ? `${fmtNum(target, 1)} kg` : undefined],
    ['IMC', imc ? fmtNum(imc, 1) : undefined],
    ['Nivel de actividad', client.activity_level ? LABELS.activity_level[client.activity_level] : undefined],
    ['Experiencia', client.training_experience ? LABELS.training_experience[client.training_experience] : undefined],
    ['Días por semana', client.training_days_per_week ? String(client.training_days_per_week) : undefined],
    ['Lugar', client.training_location ? LABELS.training_location[client.training_location] : undefined],
    ['Cliente desde', fmtDate(client.created_at)],
  ];
  const health: [string, string | undefined][] = [
    ['Condiciones médicas', client.medical_conditions],
    ['Lesiones', client.injuries],
    ['Alergias', client.allergies],
    ['Medicamentos', client.medications],
    ['Contacto de emergencia', [client.emergency_contact, client.emergency_phone].filter(Boolean).join(' · ') || undefined],
    ['Notas', client.notes],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Peso" value={s.weight === null ? '—' : `${fmtNum(s.weight, 1)} kg`} hint={target && s.weight !== null ? `Objetivo ${fmtNum(target, 1)} kg` : undefined} />
        <StatTile label="% Grasa" value={s.bodyFat === null ? '—' : `${fmtNum(s.bodyFat, 1)} %`} />
        <StatTile label="Masa muscular" value={s.muscle === null ? '—' : `${fmtNum(s.muscle, 1)} kg`} />
        <StatTile label="Grasa visceral" value={s.visceral === null ? '—' : fmtNum(s.visceral, 0)} hint={visceralFatLabel(s.visceral) ?? undefined} />
        <StatTile label="Metabolismo basal" value={s.bmr === null ? '—' : `${fmtNum(s.bmr, 0)} kcal`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Última sesión" value={relativeDays(s.daysSinceLast)} hint={s.lastSession ? fmtDate(s.lastSession) : undefined} />
        <StatTile label="Sesiones · 30 días" value={s.sessions30d} />
        <StatTile label="Adherencia · 4 semanas" value={fmtPct(s.adherence)} hint={client.training_days_per_week ? `Objetivo ${client.training_days_per_week} días/sem` : 'Define días por semana'} />
        <StatTile label="Mediciones" value={s.measurementsCount} hint={s.lastMeasurement ? `Última: ${fmtDate(s.lastMeasurement)}` : undefined} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Datos del cliente">
          <DefinitionList rows={rows} />
        </Card>
        <Card title="Salud y notas">
          <DefinitionList rows={health} />
        </Card>
      </div>
      {ms.length > 1 && (
        <Card title="Peso" subtitle={`${ms.length} mediciones`} action={<a className="text-sm text-accent-strong hover:underline" href={hrefFor({ name: 'client', id: client.id, tab: 'composicion' })}>Ver composición</a>}>
          <TrendChart data={metricSeries(ms, 'weight_kg')} unit="kg" label="Peso" />
        </Card>
      )}
    </div>
  );
}

function DefinitionList({ rows }: { rows: [string, string | undefined][] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-ink-3">{k}</dt>
          <dd className={`text-sm ${v ? 'text-ink' : 'text-ink-3'} whitespace-pre-line`}>{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/* --------------------------- Composición ----------------------------- */

function CompositionTab({ client }: { client: Client }) {
  const { data } = useData();
  const ms = measurementsOf(data!.measurements, client.id);
  const [dialog, setDialog] = useState<{ open: boolean; m: Measurement | null }>({ open: false, m: null });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setDialog({ open: true, m: null })}>
          <IconPlus size={16} /> Nueva medición
        </Button>
      </div>
      {ms.length === 0 ? (
        <Card><EmptyState title="Sin mediciones">Añade la primera medición para ver la evolución.</EmptyState></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {COMPOSITION_METRICS.map((metric) => {
              const series = metricSeries(ms, metric.key);
              const change = metricChange(ms, metric.key);
              return (
                <Card
                  key={metric.key}
                  title={metric.label}
                  subtitle={series.length > 0 ? `Último: ${fmtNum(series[series.length - 1].value, metric.decimals)} ${metric.unit}` : 'Sin datos'}
                  action={change ? (
                    <div className="text-right text-[13px]">
                      <Delta value={change.delta} unit={metric.unit} decimals={metric.decimals} better={metric.betterWhen} />
                      <p className="text-xs text-ink-3">desde {fmtDate(series[0].date, { day: 'numeric', month: 'short' })}</p>
                    </div>
                  ) : undefined}
                >
                  <TrendChart data={series} unit={metric.unit} decimals={metric.decimals} label={metric.label} />
                </Card>
              );
            })}
          </div>
          <Card title="Historial de mediciones" subtitle="Haz clic en una fila para editarla">
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-3 border-b border-line">
                    <th scope="col" className="font-medium px-5 py-2">Fecha</th>
                    {COMPOSITION_METRICS.map((m) => (
                      <th key={m.key} scope="col" className="font-medium px-3 py-2 text-right">{m.label}</th>
                    ))}
                    <th scope="col" className="font-medium px-3 py-2 text-right">Cintura</th>
                    <th scope="col" className="px-5 py-2"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ms.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-2">
                      <td className="px-5 py-2.5 whitespace-nowrap text-ink">{fmtDate(m.measured_at)}</td>
                      {COMPOSITION_METRICS.map((k) => (
                        <td key={k.key} className="px-3 py-2.5 text-right tabular text-ink-2">
                          {typeof m[k.key] === 'number' ? fmtNum(m[k.key] as number, k.decimals) : '—'}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right tabular text-ink-2">{typeof m.waist_cm === 'number' ? fmtNum(m.waist_cm, 1) : '—'}</td>
                      <td className="px-5 py-2.5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, m })} aria-label={`Editar medición del ${fmtDate(m.measured_at)}`}>
                          <IconEdit size={14} /> Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <MeasurementDialog open={dialog.open} onClose={() => setDialog({ open: false, m: null })} clientId={client.id} measurement={dialog.m} />
    </div>
  );
}

/* ----------------------------- Actividad ----------------------------- */

function ActivityTab({ client, now }: { client: Client; now: Date }) {
  const { data } = useData();
  const ss = sessionsOf(data!.sessions, client.id).sort((a, b) => b.date.localeCompare(a.date));
  const weeks = weeklyBuckets(ss, now, 12);
  const prs = Object.values(data!.prs[client.id] ?? {}).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const last12 = ss.filter((s) => daysBetween(parseDate(s.date), now) < 84);
  const avgDuration = last12.length ? last12.reduce((a, s) => a + (s.duration_minutes || 0), 0) / last12.length : null;
  const avgRpe = last12.filter((s) => s.avg_rpe > 0);
  const prsCount = last12.reduce((a, s) => a + (s.prs_achieved || 0), 0);

  if (ss.length === 0) {
    return <Card><EmptyState title="Sin sesiones registradas">Las sesiones se registran desde la app.</EmptyState></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Sesiones · 12 semanas" value={last12.length} hint={`${fmtNum(last12.length / 12, 1)} por semana`} />
        <StatTile label="Duración media" value={avgDuration === null ? '—' : `${fmtNum(avgDuration, 0)} min`} />
        <StatTile label="RPE medio" value={avgRpe.length ? fmtNum(avgRpe.reduce((a, s) => a + s.avg_rpe, 0) / avgRpe.length, 1) : '—'} />
        <StatTile label="Récords · 12 semanas" value={prsCount} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Sesiones por semana" subtitle={client.training_days_per_week ? `Objetivo: ${client.training_days_per_week} por semana` : undefined}>
          <BarsChart
            data={weeks.map((w) => ({ label: w.label, value: w.sessions, title: `Semana del ${w.label}` }))}
            valueLabel="sesiones"
            target={client.training_days_per_week ?? null}
            ariaLabel={`Sesiones por semana de ${client.full_name} en las últimas 12 semanas`}
          />
        </Card>
        <Card title="Volumen por semana" subtitle="Kilos totales levantados (peso × repeticiones)">
          <BarsChart
            data={weeks.map((w) => ({ label: w.label, value: w.sessions ? w.volume : null, title: `Semana del ${w.label}` }))}
            valueLabel="volumen"
            unit="kg"
            ariaLabel={`Volumen semanal de ${client.full_name} en las últimas 12 semanas`}
          />
        </Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Últimas sesiones">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3 border-b border-line">
                  <th scope="col" className="font-medium px-5 py-2">Fecha</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">Duración</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">Series</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">Volumen</th>
                  <th scope="col" className="font-medium px-5 py-2 text-right">RPE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ss.slice(0, 10).map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-2.5 whitespace-nowrap text-ink">{fmtDate(s.date)}</td>
                    <td className="px-3 py-2.5 text-right tabular text-ink-2">{s.duration_minutes} min</td>
                    <td className="px-3 py-2.5 text-right tabular text-ink-2">{s.total_sets}</td>
                    <td className="px-3 py-2.5 text-right tabular text-ink-2">{fmtNum(s.total_volume, 0)} kg</td>
                    <td className="px-5 py-2.5 text-right tabular text-ink-2">{s.avg_rpe ? fmtNum(s.avg_rpe, 1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Marcas personales">
          {prs.length === 0 ? (
            <EmptyState title="Sin marcas registradas" />
          ) : (
            <ul className="divide-y divide-line -mx-5">
              {prs.slice(0, 10).map((p) => (
                <li key={p.exerciseId} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{p.exerciseName}</p>
                    <p className="text-xs text-ink-3">{fmtDate(p.date)}</p>
                  </div>
                  <div className="text-right tabular">
                    <p className="text-ink">{fmtNum(p.weight, 1)} kg × {p.reps}</p>
                    <p className="text-xs text-ink-3">1RM est. {fmtNum(p.e1rm, 0)} kg</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------- Nutrición ----------------------------- */

function NutritionTab({ client, now }: { client: Client; now: Date }) {
  const { data } = useData();
  const target = data!.targetsByClient[client.id];
  const planId = data!.assignedPlanIds[client.id];
  const plan = planId ? data!.mealPlans.find((p) => p.id === planId) : undefined;
  const days = nutritionDays(data!, client.id, now, 14);
  const adh = nutritionAdherence(days, target?.calories);
  const logged = days.filter((d) => d.logged);
  const avgKcal = logged.length ? logged.reduce((a, d) => a + d.calories, 0) / logged.length : null;
  const avgProt = logged.length ? logged.reduce((a, d) => a + d.protein, 0) / logged.length : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Objetivo calórico" value={target ? `${fmtNum(target.calories, 0)} kcal` : '—'} hint={target ? `P ${target.protein} g · C ${target.carbs} g · G ${target.fat} g` : 'Sin objetivo definido'} />
        <StatTile label="Media registrada" value={avgKcal === null ? '—' : `${fmtNum(avgKcal, 0)} kcal`} hint={avgProt === null ? undefined : `Proteína ${fmtNum(avgProt, 0)} g/día`} />
        <StatTile label="Días registrados · 14" value={`${adh.logged}/14`} />
        <StatTile label="Días en objetivo (±10 %)" value={target ? `${adh.onTarget}` : '—'} hint={target && adh.logged ? `${Math.round((adh.onTarget / adh.logged) * 100)} % de los días registrados` : undefined} />
      </div>
      <Card title="Calorías por día" subtitle={plan ? `Plan asignado: ${plan.name}` : 'Sin plan asignado'}>
        {adh.logged === 0 ? (
          <EmptyState title="Sin comidas registradas en los últimos 14 días" />
        ) : (
          <BarsChart
            data={days.map((d) => ({ label: d.label, value: d.logged ? d.calories : null }))}
            valueLabel="consumidas"
            unit="kcal"
            target={target?.calories ?? null}
            ariaLabel={`Calorías por día de ${client.full_name} en los últimos 14 días${target ? `, objetivo ${target.calories} kcal` : ''}`}
          />
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ Servicio ----------------------------- */

function ServiceTab({ client, now }: { client: Client; now: Date }) {
  const { data } = useData();
  const periods = data!.periods.filter((p) => p.client_id === client.id).sort((a, b) => b.end_date.localeCompare(a.end_date));
  if (periods.length === 0) {
    return <Card><EmptyState title="Sin períodos de servicio">Los planes y pagos se registran desde la app.</EmptyState></Card>;
  }
  return (
    <Card title="Períodos de servicio">
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3 border-b border-line">
              <th scope="col" className="font-medium px-5 py-2">Plan</th>
              <th scope="col" className="font-medium px-3 py-2">Desde</th>
              <th scope="col" className="font-medium px-3 py-2">Hasta</th>
              <th scope="col" className="font-medium px-3 py-2 text-right">Precio</th>
              <th scope="col" className="font-medium px-3 py-2">Pago</th>
              <th scope="col" className="font-medium px-5 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {periods.map((p) => {
              const st = periodStatus(p, now);
              const left = daysBetween(now, parseDate(p.end_date));
              return (
                <tr key={p.id}>
                  <td className="px-5 py-2.5 text-ink">{p.plan_name}</td>
                  <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{fmtDate(p.start_date)}</td>
                  <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{fmtDate(p.end_date)}</td>
                  <td className="px-3 py-2.5 text-right tabular text-ink-2">{p.price ? p.price.toLocaleString('es-ES') : '—'}</td>
                  <td className="px-3 py-2.5">{p.paid ? <span className="text-good">Pagado</span> : <span className="text-bad">Pendiente</span>}</td>
                  <td className="px-5 py-2.5"><PeriodBadge status={st} daysLeft={left} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
