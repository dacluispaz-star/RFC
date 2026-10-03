// Gráficas del portal (recharts). Reglas: una serie por gráfica (sin doble
// eje), línea de 2px, puntos ≥8px con anillo del color de la superficie,
// cuadrícula recesiva, tooltip en hover, barras ≤24px con extremo redondeado.

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { useTheme } from '@/lib/theme';
import { fmtDate, fmtNum } from '@/lib/format';

/** Escala "bonita": ticks en pasos 1/2/2,5/5 × 10^n que cubren [min, max]. */
export function niceScale(min: number, max: number, count = 4): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1] };
  if (min === max) {
    const d = Math.abs(min) * 0.05 || 1;
    min -= d;
    max += d;
  }
  const raw = (max - min) / Math.max(count - 1, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { domain: [lo, hi], ticks };
}

function TooltipBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs text-ink-3">{title}</p>
      <p className="text-sm font-semibold text-ink tabular">{value}</p>
    </div>
  );
}

export function TrendChart({
  data,
  unit,
  decimals = 1,
  height = 180,
  label,
}: {
  data: { date: string; value: number }[];
  unit: string;
  decimals?: number;
  height?: number;
  label: string;
}) {
  const { colors } = useTheme();
  if (data.length === 0) {
    return <p className="text-sm text-ink-3 py-8 text-center">Sin mediciones de {label.toLowerCase()}.</p>;
  }
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, decimals === 0 ? 1 : 0.3);
  const scale = niceScale(min - pad, max + pad, 4);
  const rows = data.map((d) => ({ ...d, t: new Date(d.date).getTime() }));
  return (
    <div role="img" aria-label={`${label}: ${data.length} mediciones, de ${fmtNum(data[0].value, decimals)} a ${fmtNum(data[data.length - 1].value, decimals)} ${unit}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => fmtDate(new Date(t).toISOString(), { day: 'numeric', month: 'short' })}
            tick={{ fill: colors.ink3, fontSize: 12 }}
            axisLine={{ stroke: colors.axis }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={scale.domain}
            ticks={scale.ticks}
            tickFormatter={(v: number) => fmtNum(v, decimals === 0 ? 0 : 1)}
            tick={{ fill: colors.ink3, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: colors.axis, strokeWidth: 1 }}
            content={({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
              const p = payload?.[0]?.payload as { date: string; value: number } | undefined;
              if (!active || !p) return null;
              return <TooltipBox title={fmtDate(p.date)} value={`${fmtNum(p.value, decimals)} ${unit}`} />;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colors.series1}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: 4, fill: colors.series1, stroke: colors.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: colors.series1, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({
  data,
  valueLabel,
  unit = '',
  height = 220,
  target,
  targetLabel = 'Objetivo',
  decimals = 0,
  ariaLabel,
}: {
  data: { label: string; value: number | null; title?: string }[];
  valueLabel: string;
  unit?: string;
  height?: number;
  target?: number | null;
  targetLabel?: string;
  decimals?: number;
  ariaLabel: string;
}) {
  const { colors } = useTheme();
  const top = Math.max(0, ...data.map((d) => d.value ?? 0), target ?? 0);
  const scale = niceScale(0, top > 0 ? top * 1.08 : 1, 5);
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis dataKey="label" tick={{ fill: colors.ink3, fontSize: 12 }} axisLine={{ stroke: colors.axis }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis
            tick={{ fill: colors.ink3, fontSize: 12 }}
            tickFormatter={(v: number) => fmtNum(v, 0)}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={scale.domain}
            ticks={scale.ticks}
          />
          <Tooltip
            cursor={{ fill: colors.grid }}
            content={({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
              const p = payload?.[0]?.payload as { label: string; value: number | null; title?: string } | undefined;
              if (!active || !p) return null;
              return <TooltipBox title={p.title ?? p.label} value={p.value === null ? 'Sin registro' : `${fmtNum(p.value, decimals)}${unit ? ` ${unit}` : ''} · ${valueLabel}`} />;
            }}
          />
          {target ? (
            <ReferenceLine
              y={target}
              stroke={colors.ink3}
              strokeDasharray="4 4"
              label={{ value: `${targetLabel} ${fmtNum(target, 0)}${unit ? ` ${unit}` : ''}`, position: 'insideBottomLeft', fill: colors.ink2, fontSize: 12 }}
            />
          ) : null}
          <Bar dataKey="value" fill={colors.series1} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
