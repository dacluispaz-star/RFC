import { parseDate } from './analytics';

const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export function fmtNum(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return decimals === 0 ? nf0.format(v) : nf1.format(Number(v.toFixed(decimals)));
}

export function fmtUnit(v: number | null | undefined, unit: string, decimals = 1): string {
  const s = fmtNum(v, decimals);
  return s === '—' ? s : `${s} ${unit}`;
}

export function fmtSigned(v: number | null | undefined, unit = '', decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const r = Number(v.toFixed(decimals));
  const sign = r > 0 ? '+' : r < 0 ? '−' : '±';
  return `${sign}${fmtNum(Math.abs(r), decimals)}${unit ? ` ${unit}` : ''}`;
}

export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${Math.round(v * 100)} %`;
}

export function fmtDate(s: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!s) return '—';
  const d = parseDate(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES', opts);
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relativeDays(days: number | null): string {
  if (days === null) return 'Nunca';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
