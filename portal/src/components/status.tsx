import type { ActivityStatus, PeriodStatus } from '@/lib/analytics';
import { Badge } from './ui';

export function ActivityBadge({ status }: { status: ActivityStatus }) {
  if (status === 'active') return <Badge tone="good">Activo</Badge>;
  if (status === 'at_risk') return <Badge tone="warn">En riesgo</Badge>;
  if (status === 'inactive') return <Badge tone="bad">Inactivo</Badge>;
  return <Badge tone="neutral">Sin sesiones</Badge>;
}

export function PeriodBadge({ status, daysLeft }: { status: PeriodStatus; daysLeft: number | null }) {
  if (status === 'none') return <Badge tone="neutral" icon={false}>Sin plan</Badge>;
  if (status === 'expired') return <Badge tone="bad">Vencido{daysLeft !== null ? ` hace ${Math.abs(daysLeft)} d` : ''}</Badge>;
  if (status === 'expiring') return <Badge tone="warn">{daysLeft === 0 ? 'Vence hoy' : `Vence en ${daysLeft} d`}</Badge>;
  return <Badge tone="good">Al día{daysLeft !== null ? ` · ${daysLeft} d` : ''}</Badge>;
}

/** Texto de cambio con tono: `better` indica si subir es bueno. */
export function Delta({ value, unit, decimals = 1, better }: { value: number | null; unit: string; decimals?: number; better: 'higher' | 'lower' | 'context' }) {
  if (value === null) return <span className="text-ink-3">—</span>;
  const r = Number(value.toFixed(decimals));
  const tone = r === 0 || better === 'context' ? 'text-ink-2' : (r > 0) === (better === 'higher') ? 'text-good' : 'text-bad';
  const sign = r > 0 ? '+' : r < 0 ? '−' : '±';
  const arrow = r > 0 ? '↑' : r < 0 ? '↓' : '';
  return (
    <span className={`tabular whitespace-nowrap ${tone}`}>
      {arrow && <span aria-hidden="true">{arrow} </span>}
      {sign}{Math.abs(r).toLocaleString('es-ES', { maximumFractionDigits: decimals })} {unit}
    </span>
  );
}
