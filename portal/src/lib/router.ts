import { useEffect, useState } from 'react';

// Enrutado por hash (#/clientes/abc): funciona en cualquier hosting estático
// sin reglas de reescritura.
export type Route =
  | { name: 'dashboard' }
  | { name: 'clients' }
  | { name: 'client'; id: string; tab: string }
  | { name: 'plans' }
  | { name: 'plan'; id: string }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'clientes' && parts[1]) return { name: 'client', id: parts[1], tab: parts[2] || 'resumen' };
  if (parts[0] === 'clientes') return { name: 'clients' };
  if (parts[0] === 'planes' && parts[1]) return { name: 'plan', id: parts[1] };
  if (parts[0] === 'planes') return { name: 'plans' };
  if (parts[0] === 'ajustes') return { name: 'settings' };
  return { name: 'dashboard' };
}

export function hrefFor(r: Route): string {
  if (r.name === 'clients') return '#/clientes';
  if (r.name === 'plans') return '#/planes';
  if (r.name === 'plan') return `#/planes/${encodeURIComponent(r.id)}`;
  if (r.name === 'settings') return '#/ajustes';
  if (r.name === 'client') return `#/clientes/${encodeURIComponent(r.id)}${r.tab && r.tab !== 'resumen' ? `/${r.tab}` : ''}`;
  return '#/';
}

export function navigate(r: Route): void {
  window.location.hash = hrefFor(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
