import { lazy, Suspense } from 'react';
import { DataProvider, useData } from '@/lib/data';
import { ThemeProvider } from '@/lib/theme';
import { useRoute } from '@/lib/router';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { ClientsPage } from '@/pages/Clients';
import { ClientDetailPage } from '@/pages/ClientDetail';
import { PlansPage } from '@/pages/Plans';
import { SettingsPage } from '@/pages/Settings';

// El editor carga la base de alimentos (≈600 alimentos): en su propio fragmento.
const PlanEditorPage = lazy(() => import('@/pages/PlanEditor'));

function Shell() {
  const { mode, session, authReady, data, error } = useData();
  const route = useRoute();

  if (mode === 'live' && !authReady) {
    return <div className="min-h-dvh flex items-center justify-center text-sm text-ink-3" role="status">Cargando…</div>;
  }
  if (mode === 'live' && !session) return <Login />;

  return (
    <Layout route={route}>
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-bad/30 bg-bad-soft text-bad text-sm px-4 py-3">{error}</div>
      )}
      {!data ? (
        <p className="text-sm text-ink-3" role="status">Cargando datos…</p>
      ) : route.name === 'clients' ? (
        <ClientsPage />
      ) : route.name === 'client' ? (
        <ClientDetailPage id={route.id} tab={route.tab} />
      ) : route.name === 'plans' ? (
        <PlansPage />
      ) : route.name === 'plan' ? (
        <Suspense fallback={<p className="text-sm text-ink-3" role="status">Cargando editor…</p>}>
          <PlanEditorPage key={route.id} id={route.id} />
        </Suspense>
      ) : route.name === 'settings' ? (
        <SettingsPage />
      ) : (
        <Dashboard />
      )}
    </Layout>
  );
}

export default function App({ now }: { now?: Date }) {
  return (
    <ThemeProvider>
      <DataProvider now={now}>
        <Shell />
      </DataProvider>
    </ThemeProvider>
  );
}
