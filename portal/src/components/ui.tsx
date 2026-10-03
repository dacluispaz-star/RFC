import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { IconAlert, IconCheck, IconClock, IconMinus, IconX } from './icons';

function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}
export { cx };

/* ------------------------------ Button ------------------------------ */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-accent text-accent-ink hover:bg-accent-strong',
        variant === 'secondary' && 'bg-surface border border-line-strong text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'bg-bad text-white hover:opacity-90',
        className
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------- Card ------------------------------- */

export function Card({ title, action, children, className, subtitle }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('bg-surface border border-line rounded-xl', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-[13px] text-ink-3 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx(title || action ? 'px-5 pb-5' : 'p-5')}>{children}</div>
    </section>
  );
}

/* ------------------------------ StatTile ---------------------------- */

export function StatTile({ label, value, hint, delta }: { label: string; value: ReactNode; hint?: ReactNode; delta?: { text: string; tone: 'good' | 'bad' | 'neutral' } }) {
  return (
    <div className="bg-surface border border-line rounded-xl px-5 py-4">
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="mt-1 text-[28px] leading-tight font-semibold text-ink">{value}</p>
      <div className="mt-1 flex items-center gap-2 min-h-5">
        {delta && (
          <span className={cx('text-[13px] font-medium', delta.tone === 'good' && 'text-good', delta.tone === 'bad' && 'text-bad', delta.tone === 'neutral' && 'text-ink-3')}>
            {delta.text}
          </span>
        )}
        {hint && <span className="text-[13px] text-ink-3">{hint}</span>}
      </div>
    </div>
  );
}

/* ------------------------------- Badge ------------------------------ */

export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'accent';

export function Badge({ tone = 'neutral', children, icon = true }: { tone?: Tone; children: ReactNode; icon?: boolean }) {
  const Icon = tone === 'good' || tone === 'accent' ? IconCheck : tone === 'warn' ? IconClock : tone === 'bad' ? IconAlert : IconMinus;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone === 'good' && 'bg-good-soft text-good',
        tone === 'accent' && 'bg-accent-soft text-accent-strong',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'bad' && 'bg-bad-soft text-bad',
        tone === 'neutral' && 'bg-neutral-soft text-ink-2'
      )}
    >
      {icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

/* ------------------------------ Fields ------------------------------ */

export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; suffix?: string }>(
  function Field({ label, hint, suffix, className, id, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <div className={className}>
        <label htmlFor={fid} className="block text-[13px] font-medium text-ink-2 mb-1.5">{label}</label>
        <div className="relative">
          <input
            ref={ref}
            id={fid}
            {...rest}
            className={cx('w-full h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent', suffix && 'pr-14')}
          />
          {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-3 pointer-events-none">{suffix}</span>}
        </div>
        {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
      </div>
    );
  }
);

export function SelectField({ label, options, className, id, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={fid} className="block text-[13px] font-medium text-ink-2 mb-1.5">{label}</label>
      <select id={fid} {...rest} className="w-full h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TextArea({ label, className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={fid} className="block text-[13px] font-medium text-ink-2 mb-1.5">{label}</label>
      <textarea id={fid} rows={3} {...rest} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent" />
    </div>
  );
}

/* ------------------------------ Dialog ------------------------------ */

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className={cx('m-auto p-0 rounded-2xl border border-line bg-surface text-ink shadow-2xl w-[calc(100%-32px)] max-h-[90dvh]', wide ? 'max-w-3xl' : 'max-w-lg')}
    >
      {open && (
        <div className="flex flex-col max-h-[90dvh]">
          <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-line">
            <h2 id={titleId} className="text-base font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="w-9 h-9 -mr-2 rounded-lg flex items-center justify-center text-ink-3 hover:bg-surface-2 hover:text-ink">
              <IconX />
            </button>
          </header>
          <div className="px-6 py-5 overflow-y-auto">{children}</div>
          {footer && <footer className="px-6 py-4 border-t border-line flex justify-end gap-2">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/* ------------------------------- Tabs ------------------------------- */

export function Tabs({ tabs, current, hrefFor }: { tabs: { id: string; label: string }[]; current: string; hrefFor: (id: string) => string }) {
  return (
    <nav aria-label="Secciones del cliente" className="flex gap-1 border-b border-line overflow-x-auto">
      {tabs.map((t) => (
        <a
          key={t.id}
          href={hrefFor(t.id)}
          aria-current={current === t.id ? 'page' : undefined}
          className={cx(
            'px-3 h-10 inline-flex items-center text-sm whitespace-nowrap border-b-2 -mb-px',
            current === t.id ? 'border-accent text-ink font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
          )}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}

/* ---------------------------- EmptyState ---------------------------- */

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children && <p className="text-sm text-ink-3 mt-1 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full bg-accent-soft text-accent-strong font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {ini || '?'}
    </span>
  );
}
