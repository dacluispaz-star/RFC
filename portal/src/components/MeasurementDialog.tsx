import { useEffect, useState, type FormEvent } from 'react';
import { useData } from '@/lib/data';
import type { Measurement } from '@/lib/types';
import { parseOptionalNumber, visceralFatLabel } from '@/lib/bodyComposition';
import { toISODate } from '@/lib/analytics';
import { Button, Dialog, Field, TextArea } from './ui';

const FIELDS = [
  { key: 'weight_kg', label: 'Peso', suffix: 'kg', min: 20, max: 350 },
  { key: 'body_fat_pct', label: '% Grasa', suffix: '%', min: 2, max: 75 },
  { key: 'muscle_mass_kg', label: 'Masa muscular', suffix: 'kg', min: 5, max: 150 },
  { key: 'visceral_fat_level', label: 'Grasa visceral', suffix: 'nivel', min: 1, max: 59 },
  { key: 'bmr_kcal', label: 'Metabolismo basal', suffix: 'kcal', min: 500, max: 5000 },
  { key: 'waist_cm', label: 'Cintura', suffix: 'cm', min: 30, max: 250 },
] as const;

export function MeasurementDialog({ open, onClose, clientId, measurement }: { open: boolean; onClose: () => void; clientId: string; measurement?: Measurement | null }) {
  const { saveMeasurement, deleteMeasurement } = useData();
  const [date, setDate] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(measurement ? toISODate(new Date(measurement.measured_at)) : toISODate(new Date()));
    const v: Record<string, string> = {};
    for (const f of FIELDS) {
      const x = measurement?.[f.key];
      v[f.key] = typeof x === 'number' ? String(x) : '';
    }
    setValues(v);
    setNotes(measurement?.notes ?? '');
    setErrors({});
    setConfirmDelete(false);
    setSaveError(null);
  }, [open, measurement]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!date) errs.date = 'Indica la fecha';
    let any = false;
    for (const f of FIELDS) {
      if (!values[f.key]?.trim()) continue;
      const n = parseOptionalNumber(values[f.key]);
      if (n === undefined || n < f.min || n > f.max) errs[f.key] = `Entre ${f.min} y ${f.max}`;
      else any = true;
    }
    if (!any && Object.keys(errs).length === 0) errs.form = 'Introduce al menos un valor';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    setSaveError(null);
    try {
      // Mediodía local: evita que la zona horaria cambie el día.
      const [y, m, d] = date.split('-').map(Number);
      const measured_at = new Date(y, m - 1, d, 12).toISOString();
      const input: Partial<Measurement> & { client_id: string; measured_at: string } = { client_id: clientId, measured_at, notes: notes.trim() || undefined };
      for (const f of FIELDS) (input as Record<string, unknown>)[f.key] = parseOptionalNumber(values[f.key]);
      await saveMeasurement(input, measurement ?? null);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!measurement) return;
    setBusy(true);
    try {
      await deleteMeasurement(measurement.id);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={measurement ? 'Editar medición' : 'Nueva medición'}
      footer={
        <>
          {measurement && (
            confirmDelete ? (
              <Button variant="danger" className="mr-auto" onClick={() => void remove()} disabled={busy}>Confirmar eliminación</Button>
            ) : (
              <Button variant="ghost" className="mr-auto text-bad" onClick={() => setConfirmDelete(true)}>Eliminar</Button>
            )
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="measurement-form" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
        </>
      }
    >
      <form id="measurement-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={toISODate(new Date())} hint={errors.date && <span className="text-bad">{errors.date}</span>} />
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              suffix={f.suffix}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              hint={errors[f.key] ? <span className="text-bad">{errors[f.key]}</span> : f.key === 'visceral_fat_level' ? visceralFatLabel(parseOptionalNumber(values[f.key])) ?? undefined : undefined}
            />
          ))}
        </div>
        <TextArea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {errors.form && <p role="alert" className="text-sm text-bad">{errors.form}</p>}
        {saveError && <p role="alert" className="text-sm text-bad">{saveError}</p>}
      </form>
    </Dialog>
  );
}
