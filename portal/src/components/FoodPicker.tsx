import { useEffect, useMemo, useRef, useState } from 'react';
import { FOOD_CATEGORIES, FOOD_DATABASE, type Food } from '@/lib/foodDatabase';
import { fold, makeItem } from '@/lib/mealPlans';
import { fmtNum } from '@/lib/format';
import type { MealPlanItem } from '@/lib/types';
import { Button, Dialog, cx } from './ui';
import { IconCheck, IconSearch } from './icons';

const MAX_RESULTS = 80;
const CATEGORY_LABEL = new Map(FOOD_CATEGORIES.map((c) => [c.id, c.label]));

/** Selector de alimentos de la misma base que la app. Permite añadir varios seguidos. */
export function FoodPicker({ open, title, onClose, onAdd }: { open: boolean; title: string; onClose: () => void; onAdd: (item: MealPlanItem) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [added, setAdded] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const gramsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCategory('all');
    setFood(null);
    setGrams('100');
    setAdded([]);
    setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  const results = useMemo(() => {
    const words = fold(query.trim()).split(/\s+/).filter(Boolean);
    const list = FOOD_DATABASE.filter((f) => (category === 'all' || f.category === category) && words.every((w) => fold(f.name).includes(w)));
    if (words.length > 0) {
      // Primero los que empiezan por la búsqueda.
      const first = words[0];
      list.sort((a, b) => Number(!fold(a.name).startsWith(first)) - Number(!fold(b.name).startsWith(first)) || a.name.localeCompare(b.name, 'es'));
    }
    return list;
  }, [query, category]);

  const pick = (f: Food) => {
    setFood(f);
    const und = f.portions?.find((p) => p.label.trim() === '1 UND') ?? f.portions?.find((p) => /UND/.test(p.label));
    setGrams(String(und?.grams ?? f.portions?.[0]?.grams ?? 100));
    setTimeout(() => gramsRef.current?.select(), 30);
  };

  const g = Number(grams.replace(',', '.'));
  const valid = food && Number.isFinite(g) && g > 0 && g <= 5000;
  const preview = valid ? makeItem(food, g) : null;

  const add = () => {
    if (!food || !valid) return;
    onAdd(makeItem(food, Math.round(g * 10) / 10));
    setAdded((a) => [...a, `${food.name} (${Math.round(g)} g)`]);
    setFood(null);
    setQuery('');
    setTimeout(() => searchRef.current?.focus(), 30);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={<Button variant="primary" onClick={onClose}>{added.length > 0 ? `Listo · ${added.length} añadido${added.length === 1 ? '' : 's'}` : 'Cerrar'}</Button>}
    >
      <div className="grid md:grid-cols-[1fr_280px] gap-5 min-h-[420px]">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <label htmlFor="food-search" className="sr-only">Buscar alimento</label>
              <input
                id="food-search"
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0]) {
                    e.preventDefault();
                    pick(results[0]);
                  }
                }}
                placeholder="Buscar alimento…"
                className="w-full h-10 rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-3"
              />
            </div>
            <label htmlFor="food-cat" className="sr-only">Categoría</label>
            <select id="food-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink">
              {FOOD_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <ul role="listbox" aria-label="Alimentos" className="flex-1 overflow-y-auto max-h-[46dvh] rounded-lg border border-line divide-y divide-line">
            {results.length === 0 && <li className="px-3 py-6 text-sm text-ink-3 text-center">Ningún alimento coincide.</li>}
            {results.slice(0, MAX_RESULTS).map((f) => (
              <li key={f.id} role="option" aria-selected={food?.id === f.id}>
                <button
                  type="button"
                  onClick={() => pick(f)}
                  className={cx('w-full text-left px-3 py-2 flex items-baseline justify-between gap-3 hover:bg-surface-2', food?.id === f.id && 'bg-accent-soft')}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-ink truncate">{f.name}</span>
                    <span className="block text-xs text-ink-3">{CATEGORY_LABEL.get(f.category) ?? f.category}</span>
                  </span>
                  <span className="text-xs text-ink-3 tabular whitespace-nowrap">{f.calories} kcal · P {f.protein} · C {f.carbs} · G {f.fat}</span>
                </button>
              </li>
            ))}
            {results.length > MAX_RESULTS && <li className="px-3 py-2 text-xs text-ink-3 text-center">{results.length - MAX_RESULTS} más: afina la búsqueda.</li>}
          </ul>
          <p className="text-xs text-ink-3">Valores por 100 g.</p>
        </div>

        <div className="rounded-xl border border-line bg-surface-2 p-4 flex flex-col gap-4">
          {food ? (
            <>
              <div>
                <p className="font-semibold text-ink">{food.name}</p>
                <p className="text-xs text-ink-3">{food.calories} kcal por 100 g</p>
              </div>
              {food.portions && food.portions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-ink-2 mb-1.5">Porciones</p>
                  <div className="flex flex-wrap gap-1.5">
                    {food.portions.map((p, i) => (
                      <button
                        key={`${p.label}-${i}`}
                        type="button"
                        aria-pressed={Number(grams) === p.grams}
                        onClick={() => setGrams(String(p.grams))}
                        className={cx('h-8 px-2.5 rounded-full text-xs border', Number(grams) === p.grams ? 'bg-ink text-surface border-ink' : 'bg-surface text-ink-2 border-line-strong hover:text-ink')}
                      >
                        {p.label} · {p.grams} g
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="food-grams" className="block text-sm font-medium text-ink mb-1.5">Cantidad</label>
                <div className="relative">
                  <input
                    id="food-grams"
                    ref={gramsRef}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={5000}
                    step="any"
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        add();
                      }
                    }}
                    aria-invalid={!valid}
                    className="w-full h-10 rounded-lg border border-line-strong bg-surface pl-3 pr-9 text-sm text-ink tabular"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">g</span>
                </div>
              </div>
              {preview && (
                <dl className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ['kcal', fmtNum(preview.calories, 0)],
                    ['Prot.', fmtNum(preview.protein, 1)],
                    ['Carb.', fmtNum(preview.carbs, 1)],
                    ['Grasa', fmtNum(preview.fat, 1)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-surface border border-line py-2">
                      <dt className="text-[11px] text-ink-3">{k}</dt>
                      <dd className="text-sm font-semibold text-ink tabular">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <Button variant="primary" onClick={add} disabled={!valid} className="mt-auto">Añadir a la comida</Button>
            </>
          ) : (
            <div className="m-auto text-center text-sm text-ink-3 px-2">
              Elige un alimento de la lista. <span className="block mt-1 text-xs">Enter selecciona el primero; Enter otra vez lo añade.</span>
            </div>
          )}
          {added.length > 0 && (
            <ul className="text-xs text-ink-2 space-y-1 border-t border-line pt-3" aria-live="polite">
              {added.slice(-4).map((a, i) => (
                <li key={`${a}-${i}`} className="flex items-center gap-1.5"><IconCheck size={14} className="text-good shrink-0" />{a}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
