import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useData } from '@/lib/data';
import type { Client } from '@/lib/types';
import { estimateBmrKcal, parseOptionalNumber, visceralFatLabel } from '@/lib/bodyComposition';
import { Button, Dialog, Field, SelectField, TextArea } from './ui';

type FormState = Record<string, string>;

const NUMERIC: (keyof Client)[] = [
  'age', 'height_cm', 'weight_kg', 'target_weight_kg', 'body_fat_pct',
  'muscle_mass_kg', 'visceral_fat_level', 'bmr_kcal', 'training_days_per_week',
];

const TEXT: (keyof Client)[] = [
  'full_name', 'email', 'phone', 'gender', 'goal', 'occupation', 'activity_level',
  'training_experience', 'training_location', 'medical_conditions', 'injuries',
  'allergies', 'medications', 'notes', 'emergency_contact', 'emergency_phone',
];

const RANGES: Partial<Record<keyof Client, [number, number, string]>> = {
  age: [5, 110, 'Edad entre 5 y 110'],
  height_cm: [80, 250, 'Altura entre 80 y 250 cm'],
  weight_kg: [20, 350, 'Peso entre 20 y 350 kg'],
  target_weight_kg: [20, 350, 'Peso objetivo entre 20 y 350 kg'],
  body_fat_pct: [2, 75, '% grasa entre 2 y 75'],
  muscle_mass_kg: [5, 150, 'Masa muscular entre 5 y 150 kg'],
  visceral_fat_level: [1, 59, 'Grasa visceral entre 1 y 59'],
  bmr_kcal: [500, 5000, 'Metabolismo basal entre 500 y 5000 kcal'],
  training_days_per_week: [0, 7, 'Entre 0 y 7 días'],
};

function toForm(c?: Client | null): FormState {
  const f: FormState = {};
  for (const k of [...NUMERIC, ...TEXT]) {
    const v = c?.[k];
    f[k] = v === undefined || v === null ? '' : String(v);
  }
  return f;
}

/** Convierte el formulario a un cliente parcial (vacío → undefined). */
export function formToClient(f: FormState): Partial<Client> & { full_name: string } {
  const out: Record<string, unknown> = {};
  for (const k of TEXT) out[k] = f[k]?.trim() ? f[k].trim() : undefined;
  for (const k of NUMERIC) out[k] = parseOptionalNumber(f[k]);
  return { ...(out as Partial<Client>), full_name: (f.full_name ?? '').trim() };
}

export function validateClientForm(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.full_name?.trim()) e.full_name = 'El nombre es obligatorio';
  if (f.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Correo no válido';
  for (const [k, [min, max, msg]] of Object.entries(RANGES) as [keyof Client, [number, number, string]][]) {
    if (!f[k]?.trim()) continue;
    const n = parseOptionalNumber(f[k]);
    if (n === undefined || n < min || n > max) e[k] = msg;
  }
  return e;
}

export function ClientFormDialog({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: Client | null; onSaved?: (id: string) => void }) {
  const { saveClient, mode } = useData();
  const [form, setForm] = useState<FormState>(() => toForm(client));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toForm(client));
      setErrors({});
      setSaveError(null);
    }
  }, [open, client]);

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const bmrEstimate = useMemo(
    () => estimateBmrKcal({
      weightKg: parseOptionalNumber(form.weight_kg),
      heightCm: parseOptionalNumber(form.height_cm),
      age: parseOptionalNumber(form.age),
      gender: (form.gender || '') as 'male' | 'female' | 'other' | '',
    }),
    [form.weight_kg, form.height_cm, form.age, form.gender]
  );
  const visceralText = visceralFatLabel(parseOptionalNumber(form.visceral_fat_level));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateClientForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const id = await saveClient(formToClient(form), client ?? null);
      onSaved?.(id);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const err = (k: string) => (errors[k] ? <span className="text-bad">{errors[k]}</span> : undefined);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={client ? `Editar · ${client.full_name}` : 'Nuevo cliente'}
      footer={
        <>
          {saveError && <p role="alert" className="mr-auto self-center text-sm text-bad">{saveError}</p>}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="client-form" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} noValidate className="space-y-6">
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <legend className="text-sm font-semibold text-ink mb-3">Datos personales</legend>
          <Field label="Nombre completo *" value={form.full_name} onChange={set('full_name')} hint={err('full_name')} aria-invalid={!!errors.full_name} autoFocus />
          <Field label="Correo electrónico" type="email" value={form.email} onChange={set('email')} hint={err('email')} aria-invalid={!!errors.email} />
          <Field label="Teléfono" type="tel" value={form.phone} onChange={set('phone')} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Edad" type="number" inputMode="numeric" value={form.age} onChange={set('age')} hint={err('age')} />
            <SelectField label="Sexo" value={form.gender} onChange={set('gender')} options={[{ value: '', label: '—' }, { value: 'female', label: 'Mujer' }, { value: 'male', label: 'Hombre' }, { value: 'other', label: 'Otro' }]} />
          </div>
          <Field label="Objetivo" value={form.goal} onChange={set('goal')} placeholder="Ej. pérdida de grasa" className="sm:col-span-2" />
        </fieldset>

        <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <legend className="text-sm font-semibold text-ink mb-3">Datos físicos y composición corporal</legend>
          <Field label="Altura" suffix="cm" type="number" inputMode="decimal" value={form.height_cm} onChange={set('height_cm')} hint={err('height_cm')} />
          <Field label="Peso" suffix="kg" type="number" inputMode="decimal" step="0.1" value={form.weight_kg} onChange={set('weight_kg')} hint={err('weight_kg')} />
          <Field label="Peso objetivo" suffix="kg" type="number" inputMode="decimal" step="0.1" value={form.target_weight_kg} onChange={set('target_weight_kg')} hint={err('target_weight_kg')} />
          <Field label="% Grasa" suffix="%" type="number" inputMode="decimal" step="0.1" value={form.body_fat_pct} onChange={set('body_fat_pct')} hint={err('body_fat_pct')} />
          <Field label="Masa muscular" suffix="kg" type="number" inputMode="decimal" step="0.1" value={form.muscle_mass_kg} onChange={set('muscle_mass_kg')} hint={err('muscle_mass_kg')} />
          <Field label="Grasa visceral" suffix="nivel" type="number" inputMode="numeric" value={form.visceral_fat_level} onChange={set('visceral_fat_level')} hint={err('visceral_fat_level') ?? visceralText ?? undefined} />
          <div className="col-span-2">
            <div className="flex items-end gap-2">
              <Field label="Metabolismo basal" suffix="kcal" type="number" inputMode="numeric" value={form.bmr_kcal} onChange={set('bmr_kcal')} className="flex-1" />
              <Button
                variant="secondary"
                disabled={bmrEstimate === null}
                onClick={() => bmrEstimate !== null && setForm((f) => ({ ...f, bmr_kcal: String(bmrEstimate) }))}
                aria-label={bmrEstimate === null ? 'Estimar metabolismo basal (requiere peso, altura y edad)' : `Estimar metabolismo basal: ${bmrEstimate} kcal`}
              >
                Estimar
              </Button>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {errors.bmr_kcal ? <span className="text-bad">{errors.bmr_kcal}</span> : bmrEstimate === null ? 'Valor de la báscula, o completa peso, altura y edad para estimarlo.' : `Estimación Mifflin-St Jeor: ${bmrEstimate} kcal/día`}
            </p>
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <legend className="text-sm font-semibold text-ink mb-3">Entrenamiento</legend>
          <SelectField label="Nivel de actividad" value={form.activity_level} onChange={set('activity_level')} options={[{ value: '', label: '—' }, { value: 'sedentary', label: 'Sedentario' }, { value: 'light', label: 'Ligeramente activo' }, { value: 'moderate', label: 'Moderado' }, { value: 'active', label: 'Activo' }, { value: 'very_active', label: 'Muy activo' }]} />
          <SelectField label="Experiencia" value={form.training_experience} onChange={set('training_experience')} options={[{ value: '', label: '—' }, { value: 'beginner', label: 'Principiante' }, { value: 'intermediate', label: 'Intermedio' }, { value: 'advanced', label: 'Avanzado' }]} />
          <Field label="Días de entreno por semana" type="number" inputMode="numeric" value={form.training_days_per_week} onChange={set('training_days_per_week')} hint={err('training_days_per_week') ?? 'Se usa para calcular la adherencia'} />
          <SelectField label="Lugar" value={form.training_location} onChange={set('training_location')} options={[{ value: '', label: '—' }, { value: 'gym', label: 'Gimnasio' }, { value: 'home', label: 'Casa' }, { value: 'outdoors', label: 'Exterior' }, { value: 'mixed', label: 'Mixto' }]} />
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <legend className="text-sm font-semibold text-ink mb-3">Salud y notas</legend>
          <TextArea label="Condiciones médicas" value={form.medical_conditions} onChange={set('medical_conditions')} />
          <TextArea label="Lesiones" value={form.injuries} onChange={set('injuries')} />
          <TextArea label="Alergias" value={form.allergies} onChange={set('allergies')} />
          <TextArea label="Medicamentos" value={form.medications} onChange={set('medications')} />
          <Field label="Contacto de emergencia" value={form.emergency_contact} onChange={set('emergency_contact')} />
          <Field label="Teléfono de emergencia" type="tel" value={form.emergency_phone} onChange={set('emergency_phone')} />
          <TextArea label="Notas" value={form.notes} onChange={set('notes')} className="sm:col-span-2" />
        </fieldset>
        {mode === 'live' && (
          <p className="text-xs text-ink-3">Los cambios llegan al teléfono la próxima vez que la app se abra o vuelva a primer plano con conexión.</p>
        )}
      </form>
    </Dialog>
  );
}
