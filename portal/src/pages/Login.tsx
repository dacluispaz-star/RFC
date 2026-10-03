import { useState, type FormEvent } from 'react';
import { useData } from '@/lib/data';
import { isConfigured } from '@/lib/supabase';
import { Button, Field } from '@/components/ui';

export function Login() {
  const { signIn, enterDemo } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <span className="w-10 h-10 rounded-xl bg-accent text-accent-ink flex items-center justify-center font-bold text-sm">RFC</span>
          <div className="leading-tight">
            <h1 className="text-lg font-semibold text-ink">Portal del entrenador</h1>
            <p className="text-sm text-ink-3">Clientes y analítica</p>
          </div>
        </div>
        <form onSubmit={submit} className="bg-surface border border-line rounded-2xl p-6 space-y-4">
          <p className="text-sm text-ink-2">Entra con la misma cuenta que usas en la app.</p>
          <Field label="Correo electrónico" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !isConfigured}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
          {!isConfigured && (
            <p className="text-xs text-warn">Falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).</p>
          )}
        </form>
        <button type="button" onClick={enterDemo} className="mt-4 w-full text-sm text-ink-2 hover:text-ink underline underline-offset-4">
          Ver con datos de ejemplo
        </button>
      </div>
    </div>
  );
}
