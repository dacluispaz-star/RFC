import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { summarizeClient, type ClientSummary } from '@/lib/analytics';
import { fmtDate, fmtNum, fmtPct, relativeDays } from '@/lib/format';
import { hrefFor, navigate } from '@/lib/router';
import { Avatar, Button, Card, EmptyState, cx } from '@/components/ui';
import { ActivityBadge, PeriodBadge } from '@/components/status';
import { ClientFormDialog } from '@/components/ClientFormDialog';
import { IconPlus, IconSearch } from '@/components/icons';

type Filter = 'all' | 'active' | 'at_risk' | 'inactive' | 'renew';
type SortKey = 'name' | 'last' | 'sessions' | 'adherence' | 'weight' | 'fat' | 'muscle' | 'period';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'at_risk', label: 'En riesgo' },
  { id: 'inactive', label: 'Inactivos' },
  { id: 'renew', label: 'Por renovar' },
];

function matches(s: ClientSummary, f: Filter): boolean {
  if (f === 'all') return true;
  if (f === 'renew') return s.periodStatus === 'expiring' || s.periodStatus === 'expired';
  if (f === 'inactive') return s.activity === 'inactive' || s.activity === 'never';
  return s.activity === f;
}

function sortValue(s: ClientSummary, k: SortKey): number | string {
  switch (k) {
    case 'name': return s.client.full_name.toLocaleLowerCase('es');
    case 'last': return s.daysSinceLast ?? 99999;
    case 'sessions': return -s.sessions30d;
    case 'adherence': return -(s.adherence ?? -1);
    case 'weight': return s.weight ?? 99999;
    case 'fat': return s.bodyFat ?? 99999;
    case 'muscle': return -(s.muscle ?? -1);
    case 'period': return s.periodDaysLeft ?? 99999;
  }
}

export function ClientsPage() {
  const { data } = useData();
  const now = useMemo(() => new Date(), []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [creating, setCreating] = useState(false);

  const summaries = useMemo(() => (data ? data.clients.map((c) => summarizeClient(data, c, now)) : []), [data, now]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, summaries.filter((s) => matches(s, f.id)).length])) as Record<Filter, number>, [summaries]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return summaries
      .filter((s) => matches(s, filter))
      .filter((s) => !q || [s.client.full_name, s.client.email, s.client.phone, s.client.goal].some((v) => v?.toLocaleLowerCase('es').includes(q)))
      .sort((a, b) => {
        const va = sortValue(a, sort.key);
        const vb = sortValue(b, sort.key);
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
  }, [summaries, filter, query, sort]);

  if (!data) return null;

  const header = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => {
    const active = sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={cx('font-medium px-3 py-2', align === 'right' && 'text-right')}>
        <button
          type="button"
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))}
          className={cx('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}
        >
          {label}
          <span aria-hidden="true" className="text-[10px]">{active ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Clientes</h1>
          <p className="text-sm text-ink-3 mt-1">{data.clients.length} cliente{data.clients.length === 1 ? '' : 's'}</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <IconPlus size={16} /> Nuevo cliente
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <label htmlFor="client-search" className="sr-only">Buscar cliente</label>
          <input
            id="client-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, correo, teléfono…"
            className="w-full h-10 rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-3"
          />
        </div>
        <div role="group" aria-label="Filtrar clientes" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                'h-8 px-3 rounded-full text-[13px] border',
                filter === f.id ? 'bg-ink text-surface border-ink' : 'bg-surface text-ink-2 border-line-strong hover:text-ink'
              )}
            >
              {f.label} <span className="tabular opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title={data.clients.length === 0 ? 'Todavía no hay clientes' : 'Ningún cliente coincide'}
            action={data.clients.length === 0 ? <Button variant="primary" onClick={() => setCreating(true)}><IconPlus size={16} /> Nuevo cliente</Button> : undefined}
          >
            {data.clients.length === 0 ? 'Crea el primero o abre la app con conexión para que suba su copia.' : 'Prueba con otro filtro o búsqueda.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3 border-b border-line bg-surface-2">
                  <th scope="col" className="font-medium pl-5 pr-3 py-2">
                    <button type="button" onClick={() => setSort((s) => ({ key: 'name', dir: s.key === 'name' ? ((-s.dir) as 1 | -1) : 1 }))} className={cx('hover:text-ink', sort.key === 'name' && 'text-ink')}>
                      Cliente <span aria-hidden="true" className="text-[10px]">{sort.key === 'name' ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                  {header('last', 'Última sesión')}
                  {header('sessions', 'Sesiones 30 d', 'right')}
                  {header('adherence', 'Adherencia', 'right')}
                  {header('weight', 'Peso', 'right')}
                  {header('fat', '% Grasa', 'right')}
                  {header('muscle', 'Masa muscular', 'right')}
                  {header('period', 'Servicio')}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((s) => (
                  <tr
                    key={s.client.id}
                    className="hover:bg-surface-2 cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a')) return;
                      navigate({ name: 'client', id: s.client.id, tab: 'resumen' });
                    }}
                  >
                    <td className="pl-5 pr-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.client.full_name} size={34} />
                        <div className="min-w-0">
                          <a href={hrefFor({ name: 'client', id: s.client.id, tab: 'resumen' })} className="font-medium text-ink hover:underline">{s.client.full_name}</a>
                          <p className="text-xs text-ink-3 truncate max-w-[220px]">{s.client.goal || s.client.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <ActivityBadge status={s.activity} />
                        <span className="text-xs text-ink-3 whitespace-nowrap">{s.lastSession ? `${fmtDate(s.lastSession, { day: 'numeric', month: 'short' })} · ${relativeDays(s.daysSinceLast).toLowerCase()}` : 'Nunca'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular text-ink">{s.sessions30d}</td>
                    <td className="px-3 py-3 text-right tabular text-ink">{fmtPct(s.adherence)}</td>
                    <td className="px-3 py-3 text-right tabular text-ink whitespace-nowrap">{s.weight === null ? '—' : `${fmtNum(s.weight, 1)} kg`}</td>
                    <td className="px-3 py-3 text-right tabular text-ink">{s.bodyFat === null ? '—' : `${fmtNum(s.bodyFat, 1)} %`}</td>
                    <td className="px-3 py-3 text-right tabular text-ink whitespace-nowrap">{s.muscle === null ? '—' : `${fmtNum(s.muscle, 1)} kg`}</td>
                    <td className="px-3 py-3 pr-5"><PeriodBadge status={s.periodStatus} daysLeft={s.periodDaysLeft} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ClientFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => navigate({ name: 'client', id, tab: 'resumen' })}
      />
    </div>
  );
}
