import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { FOOD_DATABASE } from '@/lib/foodDatabase';
import { ALL_DAYS, DEFAULT_MEALS, cloneDay, dayTotals, planAverages, regram, sumMacros, validatePlan, type Macros } from '@/lib/mealPlans';
import { fmtNum } from '@/lib/format';
import { hrefFor } from '@/lib/router';
import type { MealPlan, MealPlanDay, MealPlanItem } from '@/lib/types';
import { Button, Card, Dialog, EmptyState, SelectField, cx } from '@/components/ui';
import { FoodPicker } from '@/components/FoodPicker';
import { PlanPdfDialog } from '@/components/PlanPdfDialog';
import { IconChevronLeft, IconCopy, IconDownload, IconPlus, IconTrash, IconX } from '@/components/icons';

const FOOD_BY_ID = new Map(FOOD_DATABASE.map((f) => [f.id, f]));

function dayOrder(name: string): number {
  const i = ALL_DAYS.indexOf(name);
  return i < 0 ? 99 : i;
}

function sortDays(days: MealPlanDay[]): MealPlanDay[] {
  return [...days].sort((a, b) => dayOrder(a.name) - dayOrder(b.name));
}

function MacroLine({ m, className }: { m: Macros; className?: string }) {
  return (
    <span className={cx('tabular', className)}>
      {fmtNum(m.calories, 0)} kcal · P {fmtNum(m.protein, 0)} · C {fmtNum(m.carbs, 0)} · G {fmtNum(m.fat, 0)}
    </span>
  );
}

function GramsInput({ item, onCommit }: { item: MealPlanItem; onCommit: (g: number) => void }) {
  const [text, setText] = useState(String(item.grams));
  useEffect(() => setText(String(item.grams)), [item.grams]);
  const commit = () => {
    const g = Number(text.replace(',', '.'));
    if (Number.isFinite(g) && g > 0 && g <= 5000) {
      if (g !== item.grams) onCommit(Math.round(g * 10) / 10);
    } else setText(String(item.grams));
  };
  return (
    <div className="relative w-24 ml-auto">
      <input
        type="number"
        inputMode="decimal"
        min={1}
        step="any"
        value={text}
        aria-label={`Gramos de ${item.food_name}`}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-full h-8 rounded-md border border-line-strong bg-surface pl-2 pr-6 text-sm text-right tabular text-ink"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-3">g</span>
    </div>
  );
}

type Draft = MealPlan;

export default function PlanEditorPage({ id }: { id: string }) {
  const { data, saveMealPlan } = useData();
  const source = data?.mealPlans.find((p) => p.id === id) ?? null;

  const [draft, setDraft] = useState<Draft | null>(source);
  const [baseline, setBaseline] = useState<string>(source ? JSON.stringify(source) : '');
  const [dayIdx, setDayIdx] = useState(0);
  const [picker, setPicker] = useState<number | null>(null); // índice de comida
  const [pdfOpen, setPdfOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [targetClient, setTargetClient] = useState<string>('');

  const dirty = !!draft && JSON.stringify(draft) !== baseline;

  // Si el plan cambia fuera (recarga) y no hay cambios locales, adoptar la versión nueva.
  useEffect(() => {
    if (!source) return;
    const s = JSON.stringify(source);
    if (!dirty && s !== baseline) {
      setDraft(source);
      setBaseline(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // Aviso al salir con cambios sin guardar (recarga/cierre y enlaces internos).
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      const href = a?.getAttribute('href');
      if (!href?.startsWith('#') || a?.target) return;
      if (!window.confirm('Hay cambios sin guardar en el plan. ¿Salir sin guardar?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const assigned = useMemo(
    () => (data && draft ? Object.entries(data.assignedPlanIds).filter(([, pid]) => pid === draft.id).map(([cid]) => cid) : []),
    [data, draft]
  );
  const clientsWithTargets = useMemo(
    () => (data ? data.clients.filter((c) => data.targetsByClient[c.id]?.calories) : []),
    [data]
  );
  useEffect(() => {
    if (targetClient || clientsWithTargets.length === 0) return;
    const first = assigned.find((cid) => clientsWithTargets.some((c) => c.id === cid));
    if (first) setTargetClient(first);
  }, [assigned, clientsWithTargets, targetClient]);

  if (!data) return null;
  if (!draft) {
    return (
      <Card>
        <EmptyState title="Plan no encontrado" action={<a href={hrefFor({ name: 'plans' })} className="text-sm text-accent-strong underline">Volver a los planes</a>}>
          Puede que se haya eliminado desde el teléfono.
        </EmptyState>
      </Card>
    );
  }

  const day = draft.days[Math.min(dayIdx, draft.days.length - 1)] as MealPlanDay | undefined;
  const di = Math.min(dayIdx, draft.days.length - 1);
  const avg = planAverages(draft);
  const target = targetClient ? data.targetsByClient[targetClient] : undefined;
  const clientNames = new Map(data.clients.map((c) => [c.id, c.full_name]));

  const update = (fn: (d: Draft) => Draft) => {
    setMsg(null);
    setDraft((d) => (d ? fn(d) : d));
  };
  const updateDay = (fn: (day: MealPlanDay) => MealPlanDay) =>
    update((d) => ({ ...d, days: d.days.map((x, i) => (i === di ? fn(x) : x)) }));
  const updateMeal = (mi: number, fn: (m: MealPlanDay['meals'][number]) => MealPlanDay['meals'][number]) =>
    updateDay((x) => ({ ...x, meals: x.meals.map((m, j) => (j === mi ? fn(m) : m)) }));

  const save = async () => {
    const problem = validatePlan(draft);
    if (problem) {
      setMsg({ tone: 'bad', text: problem });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const clean: Draft = { ...draft, name: draft.name.trim(), days: draft.days.map((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m, name: m.name.trim() })) })) };
      await saveMealPlan(clean);
      setDraft(clean);
      setBaseline(JSON.stringify(clean));
      setMsg({ tone: 'good', text: 'Guardado. Llegará a la app la próxima vez que se abra con conexión.' });
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'No se pudo guardar' });
    } finally {
      setSaving(false);
    }
  };

  const removeDay = () => {
    if (!day || draft.days.length <= 1) return;
    const has = day.meals.some((m) => m.items.length > 0);
    if (has && !window.confirm(`¿Quitar ${day.name} y sus alimentos del plan?`)) return;
    update((d) => ({ ...d, days: d.days.filter((_, i) => i !== di) }));
    setDayIdx(Math.max(0, di - 1));
  };

  const addMeal = () => {
    if (!day) return;
    const used = new Set(day.meals.map((m) => m.name));
    const name = DEFAULT_MEALS.find((m) => !used.has(m)) ?? `Comida ${day.meals.length + 1}`;
    updateDay((x) => ({ ...x, meals: [...x.meals, { name, items: [] }] }));
  };

  const removeMeal = (mi: number) => {
    if (!day) return;
    const m = day.meals[mi];
    if (m.items.length > 0 && !window.confirm(`¿Quitar ${m.name || 'esta comida'} y sus ${m.items.length} alimentos?`)) return;
    updateDay((x) => ({ ...x, meals: x.meals.filter((_, j) => j !== mi) }));
  };

  const dayTotal = day ? dayTotals(day) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <a href={hrefFor({ name: 'plans' })} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
          <IconChevronLeft size={16} /> Planes de alimentación
        </a>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[min(100%,18rem)] flex-1">
            <label htmlFor="plan-name" className="sr-only">Nombre del plan</label>
            <input
              id="plan-name"
              value={draft.name}
              maxLength={80}
              onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
              className="w-full max-w-xl text-2xl font-semibold text-ink bg-transparent rounded-lg px-2 -mx-2 py-1 border border-transparent hover:border-line focus:border-line-strong"
            />
            <p className="text-sm text-ink-3 mt-1">
              {assigned.length > 0 ? `Asignado a ${assigned.map((c) => clientNames.get(c)).filter(Boolean).join(', ')}` : 'Sin asignar (se asigna desde la app)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cx('text-xs', dirty ? 'text-warn' : 'text-ink-3')} aria-live="polite">{dirty ? 'Cambios sin guardar' : 'Todo guardado'}</span>
            <Button onClick={() => setPdfOpen(true)} title={dirty ? 'El PDF usa la versión que estás editando' : undefined}>
              <IconDownload size={16} /> PDF
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={saving || !dirty}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
        {msg && (
          <p role={msg.tone === 'bad' ? 'alert' : 'status'} className={cx('text-sm rounded-lg px-3 py-2', msg.tone === 'bad' ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good')}>
            {msg.text}
          </p>
        )}
      </header>

      <section aria-label="Resumen del plan" className="grid gap-3 grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr]">
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-xs text-ink-3">Media diaria</p>
          <p className="text-2xl font-semibold text-ink tabular">{fmtNum(avg.calories, 0)} <span className="text-sm font-normal text-ink-3">kcal</span></p>
        </div>
        {[
          ['Proteína', avg.protein, target?.protein],
          ['Carbohidratos', avg.carbs, target?.carbs],
          ['Grasas', avg.fat, target?.fat],
        ].map(([label, v, t]) => (
          <div key={label as string} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-xs text-ink-3">{label}</p>
            <p className="text-xl font-semibold text-ink tabular">{v as number} g{t ? <span className="text-xs font-normal text-ink-3"> / {t as number} g</span> : null}</p>
          </div>
        ))}
        <div className="col-span-2 lg:col-span-1 rounded-xl border border-line bg-surface px-4 py-3">
          {clientsWithTargets.length > 0 ? (
            <>
              <SelectField
                label="Comparar con objetivo de"
                value={targetClient}
                onChange={(e) => setTargetClient(e.target.value)}
                options={[{ value: '', label: 'Nadie' }, ...clientsWithTargets.map((c) => ({ value: c.id, label: c.full_name }))]}
              />
              {target && (
                <p className="text-xs text-ink-3 mt-1.5">
                  Objetivo {fmtNum(target.calories, 0)} kcal · media {avg.calories - target.calories >= 0 ? '+' : '−'}
                  {fmtNum(Math.abs(avg.calories - target.calories), 0)} kcal
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-ink-3">Los objetivos de kcal se definen en la app; aquí podrás compararlos cuando existan.</p>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 border-b border-line">
        <div role="tablist" aria-label="Días del plan" className="flex gap-1 overflow-x-auto -mb-px">
          {draft.days.map((d, i) => {
            const t = dayTotals(d);
            return (
              <button
                key={`${d.name}-${i}`}
                role="tab"
                type="button"
                aria-selected={i === di}
                onClick={() => setDayIdx(i)}
                className={cx(
                  'px-3 h-12 flex flex-col items-start justify-center border-b-2 text-left whitespace-nowrap',
                  i === di ? 'border-accent text-ink' : 'border-transparent text-ink-2 hover:text-ink'
                )}
              >
                <span className={cx('text-sm', i === di && 'font-semibold')}>{d.name}</span>
                <span className="text-[11px] text-ink-3 tabular">{fmtNum(t.calories, 0)} kcal</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex gap-1 pb-2">
          {draft.days.length < ALL_DAYS.length && (
            <Button size="sm" variant="ghost" onClick={() => setAddDayOpen(true)}><IconPlus size={14} /> Día</Button>
          )}
          {draft.days.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => setCopyOpen(true)}><IconCopy size={14} /> Copiar {day?.name} a…</Button>
          )}
          {draft.days.length > 1 && (
            <Button size="sm" variant="ghost" onClick={removeDay}><IconTrash size={14} /> Quitar día</Button>
          )}
        </div>
      </div>

      {day && (
        <div className="space-y-4" role="tabpanel" aria-label={day.name}>
          {day.meals.map((meal, mi) => {
            const mt = sumMacros(meal.items);
            return (
              <Card key={mi}>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <label htmlFor={`meal-${mi}`} className="sr-only">Nombre de la comida</label>
                  <input
                    id={`meal-${mi}`}
                    value={meal.name}
                    maxLength={40}
                    onChange={(e) => updateMeal(mi, (m) => ({ ...m, name: e.target.value }))}
                    className="font-semibold text-ink bg-transparent rounded-md px-2 -mx-2 h-8 border border-transparent hover:border-line focus:border-line-strong w-48"
                  />
                  <MacroLine m={mt} className="text-xs text-ink-3" />
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" onClick={() => setPicker(mi)}><IconPlus size={14} /> Alimento</Button>
                    <button type="button" onClick={() => removeMeal(mi)} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-3 hover:bg-bad-soft hover:text-bad" aria-label={`Quitar ${meal.name || 'comida'}`} title="Quitar comida">
                      <IconTrash size={15} />
                    </button>
                  </div>
                </div>
                {meal.items.length === 0 ? (
                  <button type="button" onClick={() => setPicker(mi)} className="w-full rounded-lg border border-dashed border-line-strong py-4 text-sm text-ink-3 hover:text-ink hover:bg-surface-2">
                    Sin alimentos · añadir
                  </button>
                ) : (
                  <div className="overflow-x-auto -mx-5">
                    <table className="w-full text-sm table-fixed min-w-[640px]">
                      <colgroup>
                        <col />
                        <col className="w-[132px]" />
                        <col className="w-[80px]" />
                        <col className="w-[80px]" />
                        <col className="w-[80px]" />
                        <col className="w-[80px]" />
                        <col className="w-[56px]" />
                      </colgroup>
                      <thead>
                        <tr className="text-xs text-ink-3 border-b border-line">
                          <th scope="col" className="font-medium text-left pl-5 pr-3 py-1.5">Alimento</th>
                          <th scope="col" className="font-medium text-right px-3 py-1.5">Cantidad</th>
                          <th scope="col" className="font-medium text-right px-3 py-1.5">kcal</th>
                          <th scope="col" className="font-medium text-right px-3 py-1.5">Prot.</th>
                          <th scope="col" className="font-medium text-right px-3 py-1.5">Carb.</th>
                          <th scope="col" className="font-medium text-right px-3 py-1.5">Grasa</th>
                          <th scope="col" className="pr-5"><span className="sr-only">Quitar</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {meal.items.map((it) => (
                          <tr key={it.id}>
                            <td className="pl-5 pr-3 py-1.5 text-ink truncate" title={it.food_name}>{it.food_name}</td>
                            <td className="px-3 py-1.5">
                              <GramsInput
                                item={it}
                                onCommit={(g) => updateMeal(mi, (m) => ({ ...m, items: m.items.map((x) => (x.id === it.id ? regram(x, g, FOOD_BY_ID.get(x.food_id)) : x)) }))}
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right tabular text-ink">{fmtNum(it.calories, 0)}</td>
                            <td className="px-3 py-1.5 text-right tabular text-ink-2">{fmtNum(it.protein, 1)}</td>
                            <td className="px-3 py-1.5 text-right tabular text-ink-2">{fmtNum(it.carbs, 1)}</td>
                            <td className="px-3 py-1.5 text-right tabular text-ink-2">{fmtNum(it.fat, 1)}</td>
                            <td className="pr-5 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => updateMeal(mi, (m) => ({ ...m, items: m.items.filter((x) => x.id !== it.id) }))}
                                className="h-7 w-7 rounded-md inline-flex items-center justify-center text-ink-3 hover:bg-bad-soft hover:text-bad"
                                aria-label={`Quitar ${it.food_name}`}
                              >
                                <IconX size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-5 py-3">
            <Button size="sm" onClick={addMeal}><IconPlus size={14} /> Añadir comida</Button>
            {dayTotal && (
              <p className="text-sm text-ink-2">
                Total {day.name}: <MacroLine m={dayTotal} className="font-semibold text-ink" />
                {target && <span className="text-ink-3"> · objetivo {fmtNum(target.calories, 0)} kcal</span>}
              </p>
            )}
          </div>
        </div>
      )}

      <FoodPicker
        open={picker !== null}
        title={day && picker !== null ? `Añadir a ${day.meals[picker]?.name ?? 'la comida'} · ${day.name}` : 'Añadir alimento'}
        onClose={() => setPicker(null)}
        onAdd={(item) => picker !== null && updateMeal(picker, (m) => ({ ...m, items: [...m.items, item] }))}
      />

      <PlanPdfDialog plan={draft} open={pdfOpen} onClose={() => setPdfOpen(false)} />

      {day && (
        <CopyDayDialog
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          from={day.name}
          options={draft.days.map((d) => d.name).filter((n) => n !== day.name)}
          onCopy={(targets) => {
            update((d) => ({ ...d, days: d.days.map((x) => (targets.includes(x.name) ? cloneDay(day, x.name) : x)) }));
            setCopyOpen(false);
          }}
        />
      )}

      <AddDayDialog
        open={addDayOpen}
        onClose={() => setAddDayOpen(false)}
        missing={ALL_DAYS.filter((d) => !draft.days.some((x) => x.name === d))}
        current={day?.name}
        onAdd={(name, copy) => {
          const nd: MealPlanDay = copy && day ? cloneDay(day, name) : { name, meals: DEFAULT_MEALS.map((m) => ({ name: m, items: [] })) };
          const next = sortDays([...draft.days, nd]);
          update((d) => ({ ...d, days: next }));
          setDayIdx(next.findIndex((x) => x === nd));
          setAddDayOpen(false);
        }}
      />
    </div>
  );
}

function CopyDayDialog({ open, onClose, from, options, onCopy }: { open: boolean; onClose: () => void; from: string; options: string[]; onCopy: (targets: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (open) setSel([]);
  }, [open]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Copiar ${from} a otros días`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={sel.length === 0} onClick={() => onCopy(sel)}>Copiar a {sel.length || ''} día{sel.length === 1 ? '' : 's'}</Button>
        </>
      }
    >
      <fieldset className="space-y-3">
        <legend className="text-sm text-ink-2 mb-2">Las comidas de los días elegidos se reemplazan por las de {from}.</legend>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setSel(sel.length === options.length ? [] : options)} className="h-9 px-3 rounded-full text-[13px] border border-line-strong text-ink-2 hover:text-ink">
            {sel.length === options.length ? 'Ninguno' : 'Todos'}
          </button>
          {options.map((d) => {
            const on = sel.includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => setSel((p) => (on ? p.filter((x) => x !== d) : [...p, d]))} className={cx('h-9 px-3 rounded-full text-[13px] border', on ? 'bg-ink text-surface border-ink' : 'bg-surface text-ink-2 border-line-strong hover:text-ink')}>
                {d}
              </button>
            );
          })}
        </div>
      </fieldset>
    </Dialog>
  );
}

function AddDayDialog({ open, onClose, missing, current, onAdd }: { open: boolean; onClose: () => void; missing: string[]; current?: string; onAdd: (name: string, copy: boolean) => void }) {
  const [name, setName] = useState('');
  const [copy, setCopy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(missing[0] ?? '');
      setCopy(false);
    }
  }, [open, missing]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Añadir día"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!name} onClick={() => onAdd(name, copy)}>Añadir {name}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Día" value={name} onChange={(e) => setName(e.target.value)} options={missing.map((d) => ({ value: d, label: d }))} />
        {current && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink mb-1">Empezar</legend>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="radio" name="add-day-mode" checked={!copy} onChange={() => setCopy(false)} /> Vacío (comidas por defecto)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="radio" name="add-day-mode" checked={copy} onChange={() => setCopy(true)} /> Copia de {current}
            </label>
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}

