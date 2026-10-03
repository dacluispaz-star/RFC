import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { downloadPlanPdf } from '@/lib/pdfDownload';
import { hrefFor } from '@/lib/router';
import type { MealPlan } from '@/lib/types';
import { Button, Dialog, SelectField } from './ui';
import { IconDownload } from './icons';

/** Elegir el cliente que aparece en el PDF y descargarlo. */
export function PlanPdfDialog({ plan, open, onClose }: { plan: MealPlan | null; open: boolean; onClose: () => void }) {
  const { data, branding } = useData();
  const [clientId, setClientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const assigned = useMemo(() => {
    if (!data || !plan) return [];
    return Object.entries(data.assignedPlanIds).filter(([, pid]) => pid === plan.id).map(([cid]) => cid);
  }, [data, plan]);

  useEffect(() => {
    if (!open || !plan) return;
    setErr(null);
    setClientId(plan.client_id ?? assigned[0] ?? '');
  }, [open, plan, assigned]);

  if (!data || !plan) return null;
  const options = [
    { value: '', label: 'Sin nombre de cliente' },
    ...data.clients.map((c) => ({ value: c.id, label: `${c.full_name}${assigned.includes(c.id) ? ' · tiene este plan' : ''}` })),
  ];

  const download = async () => {
    setBusy(true);
    setErr(null);
    try {
      const name = data.clients.find((c) => c.id === clientId)?.full_name;
      await downloadPlanPdf(plan, name, branding);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo generar el PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Descargar PDF del plan"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => void download()} disabled={busy}>
            <IconDownload size={16} /> {busy ? 'Generando…' : 'Descargar PDF'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">{plan.name}</span> · mismo diseño que el PDF de la app. Después adjúntalo en WhatsApp o en el correo.
        </p>
        <SelectField label="Cliente que aparece en el PDF" value={clientId} onChange={(e) => setClientId(e.target.value)} options={options} />
        <p className="text-xs text-ink-3">
          {branding.logoUrl ? 'Con tu logo' : 'Con el logo de RFC'}
          {branding.contactInfo ? ` y tu contacto (${branding.contactInfo})` : ' y sin datos de contacto'}.{' '}
          <a href={hrefFor({ name: 'settings' })} onClick={onClose} className="text-accent-strong underline">Cambiar en Ajustes</a>
        </p>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      </div>
    </Dialog>
  );
}
