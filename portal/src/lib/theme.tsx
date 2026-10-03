import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'rfc-portal-theme';

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

const Ctx = createContext<{ theme: Theme; toggle: () => void; colors: ChartColors }>({
  theme: 'light',
  toggle: () => {},
  colors: readColors(),
});

export interface ChartColors {
  series1: string;
  series2: string;
  grid: string;
  axis: string;
  ink: string;
  ink2: string;
  ink3: string;
  surface: string;
}

function readColors(): ChartColors {
  const cs = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const v = (n: string, f: string) => (cs?.getPropertyValue(n).trim() || f);
  return {
    series1: v('--series-1', '#0f9d6e'),
    series2: v('--series-2', '#2a78d6'),
    grid: v('--grid', '#eceeea'),
    axis: v('--axis', '#c9ccc6'),
    ink: v('--ink', '#101828'),
    ink2: v('--ink-2', '#475467'),
    ink3: v('--ink-3', '#6b7280'),
    surface: v('--surface', '#ffffff'),
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme());
  const [colors, setColors] = useState<ChartColors>(readColors);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    setColors(readColors());
  }, [theme]);

  useEffect(() => {
    if (stored()) return;
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const on = () => setTheme(mq.matches ? 'dark' : 'light');
      mq.addEventListener('change', on);
      return () => mq.removeEventListener('change', on);
    } catch {
      return undefined;
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch {}
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, toggle, colors }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
