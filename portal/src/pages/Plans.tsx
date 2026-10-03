import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { ALL_DAYS, DEFAULT_DAYS, blankPlan, countItems, fold, planAverages } from '@/lib/mealPlans';
import { fmtNum } from '@/lib/format';
import { hrefFor, navigate } from '@/lib/router';
import type { MealPlan } from '@/lib/types';
import { Button, Card, Dialog, EmptyState, Field, cx } from '@/components/ui';
import { PlanPdfDialog } from '@/components/PlanPdfDialog';
import { IconDownload, IconEdit, IconPlus, IconSearch, IconTrash } from '@/components/icons';

function dayRange(plan: MealPlan): string {
  const n = plan.days.length;
  if (n === 0) return 'Sin días';
  if (n === 7) return 'Semana completa';
  if (n === 1) return plan.days[0].name;
  return `${plan.days[0].name} – ${plan.days[n - 1].name} · ${n} días`;
}

export function PlansPage() {
  const { data, saveMealPlan, deleteMealPlan } = useData();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [pdfPlan, setPdfPlan] = useState<MealPlan | null>(null);
  const [deleting, setDeleting] = useState<MealPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clientName = useMemo(() => new Map((data?.clients ?? []).map((c) => [c.id, c.full_name])), [data]);
  const rows = useMemo(() => {
    if (!data) return [];
    const q = fold(query.trim());
    return [...data.mealPlans]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((plan) => ({
        plan,
        avg: planAverages(plan),
        items: countItems(plan),
        clients: Object.entries(data.assignedPlanIds)
          .filter(([, pid]) => pid === plan.id)
          .map(([cid]) => clientName.get(cid))
          .filter((n): n is string => !!n),
      }))
      .filter((r) => !q || fold(r.plan.name).includes(q) || r.clients.some((c) => fold(c).includes(q)));
  }, [data, query, clientName]);

  if (!data) return null;

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteMealPlan(deleting.id);
      setDeleting(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Planes de alimentación</h1>
          <p className="text-sm text-ink-3 mt-1">
            {data.mealPlans.length} plan{data.mealPlans.length === 1 ? '' : 'es'} · los cambios llegan a la app al abrirla con conexión
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <IconPlus size={16} /> Nuevo plan
        </Button>
      </header>

      {data.mealPlans.length > 0 && (
        <div className="relative w-full sm:w-72">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <label htmlFor="plan-search" className="sr-only">Buscar plan</label>
          <input
            id="plan-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por plan o cliente…"
            className="w-full h-10 rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-3"
          />
        </div>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title={data.mealPlans.length === 0 ? 'Todavía no hay planes' : 'Ningún plan coincide'}
            action={data.mealPlans.length === 0 ? <Button variant="primary" onClick={() => setCreating(true)}><IconPlus size={16} /> Nuevo plan</Button> : undefined}
          >
            {data.mealPlans.length === 0 ? 'Crea el primero: eliges los días y después añades los alimentos de cada comida.' : 'Prueba con otra búsqueda.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3 border-b border-line bg-surface-2">
                  <th scope="col" className="font-medium pl-5 pr-3 py-2">Plan</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">kcal / día</th>
                  <th scope="col" className="font-medium px-3 py-2 text-right">P · C · G (g)</th>
                  <th scope="col" className="font-medium px-3 py-2">Asignado a</th>
                  <th scope="col" className="font-medium px-3 py-2 pr-5 text-right"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ plan, avg, items, clients }) => (
                  <tr key={plan.id} className="hover:bg-surface-2">
                    <td className="pl-5 pr-3 py-3">
                      <a href={hrefFor({ name: 'plan', id: plan.id })} className="font-medium text-ink hover:underline">{plan.name}</a>
                      <p className="text-xs text-ink-3">{dayRange(plan)} · {items} alimento{items === 1 ? '' : 's'}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular text-ink">{items === 0 ? '—' : fmtNum(avg.calories, 0)}</td>
                    <td className="px-3 py-3 text-right tabular text-ink-2 whitespace-nowrap">{items === 0 ? '—' : `${avg.protein} · ${avg.carbs} · ${avg.fat}`}</td>
                    <td className="px-3 py-3 text-ink-2">
                      {clients.length === 0 ? <span className="text-ink-3">—</span> : <span className="line-clamp-2">{clients.join(', ')}</span>}
                    </td>
                    <td className="px-3 py-3 pr-5">
                      <div className="flex justify-end gap-1">
                        <a href={hrefFor({ name: 'plan', id: plan.id })} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-2 hover:bg-surface hover:text-ink" title="Editar" aria-label={`Editar ${plan.name}`}>
                          <IconEdit size={16} />
                        </a>
                        <button type="button" onClick={() => setPdfPlan(plan)} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-2 hover:bg-surface hover:text-ink" title="Descargar PDF" aria-label={`Descargar PDF de ${plan.name}`}>
                          <IconDownload size={16} />
                        </button>
                        <button type="button" onClick={() => { setErr(null); setDeleting(plan); }} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-2 hover:bg-bad-soft hover:text-bad" title="Eliminar" aria-label={`Eliminar ${plan.name}`}>
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewPlanDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (name, days) => {
          const id = await saveMealPlan(blankPlan(name, days));
          setCreating(false);
          navigate({ name: 'plan', id });
        }}
      />

      <PlanPdfDialog plan={pdfPlan} open={!!pdfPlan} onClose={() => setPdfPlan(null)} />

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eliminar plan"
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => void confirmDelete()} disabled={busy}>{busy ? 'Eliminando…' : 'Eliminar plan'}</Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Se eliminará <span className="font-medium text-ink">{deleting?.name}</span> también en la app del teléfono, y dejará de estar asignado a sus clientes.
        </p>
        {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
      </Dialog>
    </div>
  );
}

export function NewPlanDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, days: string[]) => Promise<void> }) {
  const [name, setName] = useState('');
  const [days, setDays] = useState<string[]>(DEFAULT_DAYS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setDays(DEFAULT_DAYS);
    setErr(null);
  };

  const submit = async () => {
    if (!name.trim()) return setErr('Ponle un nombre al plan.');
    if (days.length === 0) return setErr('Elige al menos un día.');
    setBusy(true);
    setErr(null);
    try {
      await onCreate(name, days);
      reset();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo crear el plan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Nuevo plan de alimentación"
      footer={
        <>
          <Button onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Creando…' : 'Crear y editar'}</Button>
        </>
      }
    >
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Nombre del plan" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Definición · Fase 1" maxLength={80} autoFocus />
        <fieldset>
          <legend className="text-sm font-medium text-ink mb-2">Días</legend>
          <div className="flex flex-wrap gap-1.5">
            {ALL_DAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays((p) => (on ? p.filter((x) => x !== d) : [...p, d]))}
                  className={cx('h-9 px-3 rounded-full text-[13px] border', on ? 'bg-ink text-surface border-ink' : 'bg-surface text-ink-2 border-line-strong hover:text-ink')}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-3 mt-2">Cada día empieza con Desayuno, Merienda, Almuerzo, Snack y Cena, como en la app.</p>
        </fieldset>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      </form>
    </Dialog>
  );
}
