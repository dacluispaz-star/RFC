// Capa de datos del portal: sesión (Supabase Auth), carga de la copia en la
// nube + cambios pendientes, y guardado de cambios (cola `portal_changes`).
// En modo demo todo vive en memoria.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isConfigured } from './supabase';
import { buildPortalData } from './overlay';
import { demoPayload } from './demo';
import type { BackupPayload, Branding, Client, MealPlan, Measurement, PortalChange, PortalData } from './types';

export type Mode = 'live' | 'demo';

interface DataApi {
  mode: Mode;
  session: Session | null;
  authReady: boolean;
  data: PortalData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Crea o edita un cliente. Devuelve su id. */
  saveClient: (input: Partial<Client> & { full_name: string }, previous?: Client | null) => Promise<string>;
  saveMeasurement: (input: Partial<Measurement> & { client_id: string; measured_at: string }, previous?: Measurement | null) => Promise<string>;
  deleteMeasurement: (id: string) => Promise<void>;
  /** Crea o reemplaza un plan de alimentación completo. Devuelve su id. */
  saveMealPlan: (plan: Omit<MealPlan, 'id'> & { id?: string }) => Promise<string>;
  deleteMealPlan: (id: string) => Promise<void>;
  /** Logo y contacto del PDF. */
  branding: Branding;
  saveBranding: (b: Branding) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  exitDemo: () => void;
}

const Ctx = createContext<DataApi | null>(null);

export function useData(): DataApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData fuera de DataProvider');
  return v;
}

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }
}

/** Solo los campos que cambian (null = campo vaciado). */
export function diffRecord<T extends object>(next: Partial<T>, prev?: Partial<T> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(next), ...(prev ? Object.keys(prev) : [])]);
  for (const k of keys) {
    if (k === 'id') continue;
    if (!(k in next)) continue; // campo no editado en el formulario
    const a = (next as Record<string, unknown>)[k];
    const b = prev ? (prev as Record<string, unknown>)[k] : undefined;
    const na = a === '' || a === undefined ? null : a;
    const nb = b === '' || b === undefined ? null : b;
    if (JSON.stringify(na) !== JSON.stringify(nb)) out[k] = na;
  }
  return out;
}

const DEMO_KEY = 'rfc-portal-demo';
const BRANDING_KEY = 'rfc-portal-branding';
const EMPTY_BRANDING: Branding = { logoUrl: null, contactInfo: '' };

function normBranding(v: unknown): Branding {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return {
    logoUrl: typeof o.logoUrl === 'string' && o.logoUrl.startsWith('data:image/') ? o.logoUrl : null,
    contactInfo: typeof o.contactInfo === 'string' ? o.contactInfo : '',
  };
}

function readCachedBranding(): Branding {
  try {
    const raw = localStorage.getItem(BRANDING_KEY);
    return raw ? normBranding(JSON.parse(raw)) : EMPTY_BRANDING;
  } catch {
    return EMPTY_BRANDING;
  }
}

function cacheBranding(b: Branding): void {
  try {
    localStorage.setItem(BRANDING_KEY, JSON.stringify(b));
  } catch {}
}

function initialMode(): Mode {
  if (!isConfigured) return 'demo';
  try {
    if (new URLSearchParams(window.location.search).has('demo')) return 'demo';
    return sessionStorage.getItem(DEMO_KEY) === '1' ? 'demo' : 'live';
  } catch {
    return 'live';
  }
}

export function DataProvider({ children, now }: { children: ReactNode; now?: Date }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isConfigured);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<Branding>(EMPTY_BRANDING);

  // Modo demo: copia + cambios en memoria.
  const demoBase = useRef<BackupPayload | null>(null);
  const demoChanges = useRef<PortalChange[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data: d }) => {
      if (!alive) return;
      setSession(d.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    if (mode === 'demo') {
      demoBase.current ??= demoPayload(now ?? new Date());
      setData(buildPortalData(demoBase.current, demoChanges.current, new Date().toISOString()));
      return;
    }
    if (!supabase || !session) return;
    setLoading(true);
    try {
      const [backup, pending] = await Promise.all([
        supabase.from('user_backups').select('payload,updated_at').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('portal_changes').select('id,entity,op,record_id,record,created_at').is('applied_at', null).order('created_at', { ascending: true }),
      ]);
      if (backup.error) throw backup.error;
      if (pending.error) {
        // Sin la tabla (migración no ejecutada) el portal sigue en solo lectura.
        if (/portal_changes/.test(pending.error.message)) {
          setError('Falta ejecutar la migración de Supabase "portal_changes": el portal funciona en solo lectura.');
        } else throw pending.error;
      }
      const row = backup.data as { payload: BackupPayload; updated_at: string } | null;
      setData(buildPortalData(row?.payload ?? null, (pending.data as PortalChange[] | null) ?? [], row?.updated_at ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [mode, session, now]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Marca del PDF: Supabase (portal_settings) con copia local de respaldo.
  const userId = session?.user.id;
  useEffect(() => {
    if (mode === 'demo') {
      setBranding(EMPTY_BRANDING);
      return;
    }
    setBranding(readCachedBranding());
    if (!supabase || !userId) return;
    let alive = true;
    void supabase
      .from('portal_settings')
      .select('branding')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data: row, error: err }) => {
        if (!alive || err || !row) return;
        const b = normBranding((row as { branding: unknown }).branding);
        setBranding(b);
        cacheBranding(b);
      });
    return () => {
      alive = false;
    };
  }, [mode, userId]);

  const saveBranding = useCallback<DataApi['saveBranding']>(
    async (b) => {
      const next = normBranding(b);
      setBranding(next);
      if (mode === 'demo') return;
      cacheBranding(next);
      if (!supabase || !userId) return;
      const { error: err } = await supabase
        .from('portal_settings')
        .upsert({ user_id: userId, branding: next, updated_at: new Date().toISOString() });
      if (err) {
        throw new Error(
          /portal_settings/.test(err.message)
            ? 'Guardado solo en este navegador: falta ejecutar la migración "portal-meal-plans" en Supabase.'
            : err.message
        );
      }
    },
    [mode, userId]
  );

  const pushChange = useCallback(
    async (change: Omit<PortalChange, 'id' | 'created_at'>) => {
      if (mode === 'demo') {
        demoChanges.current = [...demoChanges.current, { ...change, id: uuid(), created_at: new Date().toISOString() }];
        await reload();
        return;
      }
      if (!supabase) throw new Error('Supabase no está configurado');
      const { error: err } = await supabase.from('portal_changes').insert(change);
      if (err) throw new Error(err.message);
      await reload();
    },
    [mode, reload]
  );

  const saveClient = useCallback<DataApi['saveClient']>(
    async (input, previous) => {
      const isNew = !previous;
      const id = previous?.id ?? `local-${uuid()}`;
      const record = isNew
        ? { ...diffRecord(input, null), full_name: input.full_name.trim(), email: input.email ?? '', created_at: new Date().toISOString() }
        : diffRecord(input, previous);
      if (!isNew && Object.keys(record).length === 0) return id;
      await pushChange({ entity: 'client', op: 'upsert', record_id: id, record });
      return id;
    },
    [pushChange]
  );

  const saveMeasurement = useCallback<DataApi['saveMeasurement']>(
    async (input, previous) => {
      const id = previous?.id ?? uuid();
      const record = previous ? diffRecord(input, previous) : { ...diffRecord(input, null), client_id: input.client_id, measured_at: input.measured_at };
      if (previous && Object.keys(record).length === 0) return id;
      await pushChange({ entity: 'measurement', op: 'upsert', record_id: id, record });
      return id;
    },
    [pushChange]
  );

  const deleteMeasurement = useCallback<DataApi['deleteMeasurement']>(
    (id) => pushChange({ entity: 'measurement', op: 'delete', record_id: id, record: null }),
    [pushChange]
  );

  const saveMealPlan = useCallback<DataApi['saveMealPlan']>(
    async (plan) => {
      const id = plan.id ?? uuid();
      const { id: _omit, ...rest } = plan;
      void _omit;
      const record: Record<string, unknown> = { name: rest.name.trim(), days: rest.days };
      if (rest.client_id) record.client_id = rest.client_id;
      await pushChange({ entity: 'meal_plan', op: 'upsert', record_id: id, record });
      return id;
    },
    [pushChange]
  );

  const deleteMealPlan = useCallback<DataApi['deleteMealPlan']>(
    (id) => pushChange({ entity: 'meal_plan', op: 'delete', record_id: id, record: null }),
    [pushChange]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase no está configurado');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) throw new Error(err.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : err.message);
  }, []);

  const signOut = useCallback(async () => {
    setData(null);
    if (mode === 'demo') {
      try { sessionStorage.removeItem(DEMO_KEY); } catch {}
      setMode('live');
      return;
    }
    await supabase?.auth.signOut();
  }, [mode]);

  const enterDemo = useCallback(() => {
    try { sessionStorage.setItem(DEMO_KEY, '1'); } catch {}
    demoBase.current = null;
    demoChanges.current = [];
    setMode('demo');
  }, []);

  const exitDemo = useCallback(() => {
    try { sessionStorage.removeItem(DEMO_KEY); } catch {}
    setData(null);
    setMode('live');
  }, []);

  const api = useMemo<DataApi>(
    () => ({ mode, session, authReady, data, loading, error, reload, saveClient, saveMeasurement, deleteMeasurement, saveMealPlan, deleteMealPlan, branding, saveBranding, signIn, signOut, enterDemo, exitDemo }),
    [mode, session, authReady, data, loading, error, reload, saveClient, saveMeasurement, deleteMeasurement, saveMealPlan, deleteMealPlan, branding, saveBranding, signIn, signOut, enterDemo, exitDemo]
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
