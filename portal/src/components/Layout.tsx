import { useState, type ReactNode } from 'react';
import { useData } from '@/lib/data';
import { useTheme } from '@/lib/theme';
import { hrefFor, type Route } from '@/lib/router';
import { fmtDateTime } from '@/lib/format';
import { cx } from './ui';
import { IconCloud, IconGrid, IconLogout, IconMenu, IconMoon, IconRefresh, IconSun, IconUsers, IconX } from './icons';

const NAV = [
  { route: { name: 'dashboard' } as Route, label: 'Panel', Icon: IconGrid },
  { route: { name: 'clients' } as Route, label: 'Clientes', Icon: IconUsers },
];

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { mode, session, data, loading, reload, signOut } = useData();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const section = route.name === 'client' ? 'clients' : route.name;

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16">
        <span className="w-8 h-8 rounded-lg bg-accent text-accent-ink flex items-center justify-center font-bold text-[11px] tracking-tight">RFC</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">Portal del entrenador</p>
          <p className="text-xs text-ink-3">Analítica de clientes</p>
        </div>
      </div>
      <nav aria-label="Principal" className="px-3 py-2 space-y-1">
        {NAV.map(({ route: r, label, Icon }) => (
          <a
            key={label}
            href={hrefFor(r)}
            onClick={() => setMenuOpen(false)}
            aria-current={section === r.name ? 'page' : undefined}
            className={cx(
              'flex items-center gap-3 h-10 px-3 rounded-lg text-sm',
              section === r.name ? 'bg-accent-soft text-accent-strong font-semibold' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
            )}
          >
            <Icon />
            {label}
          </a>
        ))}
      </nav>
      <div className="mt-auto p-4 space-y-3 border-t border-line">
        <div className="text-xs text-ink-3 space-y-1">
          <p className="flex items-center gap-1.5">
            <IconCloud size={14} />
            {mode === 'demo' ? 'Datos de ejemplo' : `Copia del teléfono: ${fmtDateTime(data?.backupUpdatedAt)}`}
          </p>
          {data && data.pendingCount > 0 && (
            <p>{data.pendingCount} cambio{data.pendingCount === 1 ? '' : 's'} del portal pendiente{data.pendingCount === 1 ? '' : 's'} de llegar al teléfono</p>
          )}
          {mode === 'live' && session?.user.email && <p className="truncate" title={session.user.email}>{session.user.email}</p>}
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => void reload()} disabled={loading} className="h-9 w-9 rounded-lg flex items-center justify-center text-ink-2 hover:bg-surface-2 disabled:opacity-50" aria-label="Actualizar datos" title="Actualizar datos">
            <IconRefresh className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={toggle} className="h-9 w-9 rounded-lg flex items-center justify-center text-ink-2 hover:bg-surface-2" aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'} title="Cambiar tema">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button type="button" onClick={() => void signOut()} title={mode === 'demo' ? 'Salir de la demo' : 'Cerrar sesión'} className="ml-auto h-9 px-3 rounded-lg flex items-center gap-2 text-sm text-ink-2 hover:bg-surface-2">
            <IconLogout size={16} />
            {mode === 'demo' ? 'Salir' : 'Salir'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-surface px-3 py-2 rounded-lg">Saltar al contenido</a>
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-surface border-r border-line">{sidebar}</aside>

      <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 h-14 px-4 bg-surface border-b border-line">
        <button type="button" onClick={() => setMenuOpen(true)} className="h-9 w-9 -ml-1 rounded-lg flex items-center justify-center text-ink-2" aria-label="Abrir menú">
          <IconMenu />
        </button>
        <span className="text-sm font-semibold">Portal del entrenador</span>
      </header>
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface border-r border-line">
            <button type="button" onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 h-9 w-9 rounded-lg flex items-center justify-center text-ink-2" aria-label="Cerrar menú">
              <IconX />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {mode === 'demo' && (
        <div className="bg-warn-soft text-warn text-[13px] px-6 py-2 text-center">
          Modo demostración: datos de ejemplo. Los cambios no se guardan ni llegan al teléfono.
        </div>
      )}
      <main id="main" className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px]">{children}</main>
    </div>
  );
}
