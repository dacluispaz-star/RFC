import { useMemo } from 'react';
import { useData } from '@/lib/data';
import { dashboardStats, measurementsOf, nutritionAdherence, nutritionDays, recentChange, summarizeClient, weeklyBuckets } from '@/lib/analytics';
import { fmtDate, fmtNum, fmtPct, relativeDays } from '@/lib/format';
import { hrefFor } from '@/lib/router';
import { BarsChart } from '@/components/charts';
import { Avatar, Card, EmptyState, StatTile } from '@/components/ui';
import { ActivityBadge, Delta, PeriodBadge } from '@/components/status';

export function Dashboard({ now: nowProp }: { now?: Date }) {
  const { data } = useData();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const summaries = useMemo(() => (data ? data.clients.map((c) => summarizeClient(data, c, now)) : []), [data, now]);
  const stats = useMemo(() => (data ? dashboardStats(summaries, data.sessions, now) : null), [data, summaries, now]);
  const weeks = useMemo(() => (data ? weeklyBuckets(data.sessions, now, 12) : []), [data, now]);

  if (!data || !stats) return null;

  if (data.clients.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Todavía no hay clientes"
          action={<a href={hrefFor({ name: 'clients' })} className="text-sm font-medium text-accent-strong underline underline-offset-4">Ir a Clientes</a>}
        >
          Crea clientes aquí o desde la app. Si ya los tienes en el teléfono, abre la app con conexión para que suba su copia.
        </EmptyState>
      </Card>
    );
  }

  const attention = summaries
    .filter((s) => s.activity !== 'active')
    .sort((a, b) => (b.daysSinceLast ?? 9999) - (a.daysSinceLast ?? 9999))
    .slice(0, 6);
  const renewals = summaries
    .filter((s) => s.periodStatus === 'expiring' || s.periodStatus === 'expired')
    .sort((a, b) => (a.periodDaysLeft ?? 0) - (b.periodDaysLeft ?? 0));
  const composition = summaries
    .map((s) => ({ s, ms: measurementsOf(data.measurements, s.client.id) }))
    .filter((x) => x.ms.length > 0)
    .sort((a, b) => b.ms[0].measured_at.localeCompare(a.ms[0].measured_at));
  const nutrition = summaries
    .map((s) => {
      const target = data.targetsByClient[s.client.id]?.calories;
      const days = nutritionDays(data, s.client.id, now, 14);
      return { s, target, ...nutritionAdherence(days, target) };
    })
    .filter((x) => x.target || x.logged > 0);

  const sessionDelta = stats.sessions30d - stats.sessionsPrev30d;
  const thisWeek = weeks[weeks.length - 1];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Panel</h1>
        <p className="text-sm text-ink-3 mt-1">{now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label="Clientes activos"
          value={<>{stats.activeClients}<span className="text-base font-medium text-ink-3"> de {stats.totalClients}</span></>}
          hint={`${stats.atRiskClients} en riesgo · ${stats.inactiveClients} inactivos`}
        />
        <StatTile
          label="Sesiones · últimos 30 días"
          value={fmtNum(stats.sessions30d, 0)}
          delta={{ text: `${sessionDelta >= 0 ? '+' : '−'}${Math.abs(sessionDelta)} vs. 30 días previos`, tone: sessionDelta > 0 ? 'good' : sessionDelta < 0 ? 'bad' : 'neutral' }}
        />
        <StatTile label="Adherencia media · 4 semanas" value={fmtPct(stats.avgAdherence)} hint="Sesiones hechas / días objetivo" />
        <StatTile
          label="Servicios a renovar"
          value={fmtNum(stats.expiring + stats.expired, 0)}
          hint={`${stats.expiring} por vencer · ${stats.expired} vencidos`}
        />
      </div>

      <Card title="Sesiones por semana" subtitle={`Todas las sesiones de tus clientes · esta semana: ${thisWeek?.sessions ?? 0}`}>
        <BarsChart
          data={weeks.map((w) => ({ label: w.label, value: w.sessions, title: `Semana del ${w.label}` }))}
          valueLabel="sesiones"
          ariaLabel={`Sesiones por semana en las últimas 12 semanas. Esta semana: ${thisWeek?.sessions ?? 0}.`}
        />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Necesitan atención" subtitle="Clientes sin entrenar en más de 7 días">
          {attention.length === 0 ? (
            <EmptyState title="Todos tus clientes entrenaron esta semana" />
          ) : (
            <ul className="divide-y divide-line -mx-5">
              {attention.map((s) => (
                <li key={s.client.id}>
                  <a href={hrefFor({ name: 'client', id: s.client.id, tab: 'actividad' })} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <Avatar name={s.client.full_name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{s.client.full_name}</p>
                      <p className="text-xs text-ink-3">Última sesión: {s.lastSession ? `${fmtDate(s.lastSession)} · ${relativeDays(s.daysSinceLast).toLowerCase()}` : 'nunca'}</p>
                    </div>
                    <ActivityBadge status={s.activity} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Vencimientos" subtitle="Planes por vencer (7 días) o vencidos">
          {renewals.length === 0 ? (
            <EmptyState title="No hay planes por vencer" />
          ) : (
            <ul className="divide-y divide-line -mx-5">
              {renewals.map((s) => (
                <li key={s.client.id}>
                  <a href={hrefFor({ name: 'client', id: s.client.id, tab: 'servicio' })} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <Avatar name={s.client.full_name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{s.client.full_name}</p>
                      <p className="text-xs text-ink-3 truncate">{s.period?.plan_name} · hasta {fmtDate(s.period?.end_date)}{s.period && !s.period.paid ? ' · sin pagar' : ''}</p>
                    </div>
                    <PeriodBadge status={s.periodStatus} daysLeft={s.periodDaysLeft} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Composición corporal" subtitle="Último valor y cambio respecto a la medición anterior">
        {composition.length === 0 ? (
          <EmptyState title="Sin mediciones todavía" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3 border-b border-line">
                  <th scope="col" className="font-medium px-5 py-2">Cliente</th>
                  <th scope="col" className="font-medium px-3 py-2">Medición</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">Peso</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">% Grasa</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">Masa muscular</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">G. visceral</th>
                  <th scope="col" className="font-medium px-5 py-2 text-right">Metab. basal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {composition.map(({ s, ms }) => (
                  <tr key={s.client.id} className="hover:bg-surface-2">
                    <td className="px-5 py-2.5">
                      <a href={hrefFor({ name: 'client', id: s.client.id, tab: 'composicion' })} className="font-medium text-ink hover:underline">{s.client.full_name}</a>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{fmtDate(ms[0].measured_at)}</td>
                    <MetricCell value={s.weight} unit="kg" change={recentChange(ms, 'weight_kg')} better="context" />
                    <MetricCell value={s.bodyFat} unit="%" change={recentChange(ms, 'body_fat_pct')} better="lower" />
                    <MetricCell value={s.muscle} unit="kg" change={recentChange(ms, 'muscle_mass_kg')} better="higher" />
                    <MetricCell value={s.visceral} unit="" decimals={0} change={recentChange(ms, 'visceral_fat_level')} better="lower" />
                    <MetricCell value={s.bmr} unit="kcal" decimals={0} change={recentChange(ms, 'bmr_kcal')} better="context" last />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Nutrición · últimos 14 días" subtitle="Días con comidas registradas y días dentro de ±10 % del objetivo calórico">
        {nutrition.length === 0 ? (
          <EmptyState title="Sin objetivos ni registros de comidas" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3 border-b border-line">
                  <th scope="col" className="font-medium px-5 py-2">Cliente</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">Objetivo</th>
                  <th scope="col" className="font-medium px-3 py-2">Días registrados</th>
                  <th scope="col" className="font-medium px-5 py-2 text-right">En objetivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {nutrition.map(({ s, target, logged, onTarget }) => (
                  <tr key={s.client.id} className="hover:bg-surface-2">
                    <td className="px-5 py-2.5">
                      <a href={hrefFor({ name: 'client', id: s.client.id, tab: 'nutricion' })} className="font-medium text-ink hover:underline">{s.client.full_name}</a>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-ink-2">{target ? `${fmtNum(target, 0)} kcal` : '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-28 rounded-full bg-surface-3" aria-hidden="true">
                          <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(logged / 14) * 100}%` }} />
                        </div>
                        <span className="tabular text-ink-2">{logged}/14</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular text-ink-2">{target ? `${onTarget} días` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function MetricCell({ value, unit, change, better, decimals = 1, last }: { value: number | null; unit: string; change: number | null; better: 'higher' | 'lower' | 'context'; decimals?: number; last?: boolean }) {
  return (
    <td className={`${last ? 'px-5' : 'px-3'} py-2.5 text-right`}>
      <div className="tabular text-ink">{value === null ? '—' : `${fmtNum(value, decimals)}${unit ? ` ${unit}` : ''}`}</div>
      {change !== null && <div className="text-xs"><Delta value={change} unit={unit} decimals={decimals} better={better} /></div>}
    </td>
  );
}
