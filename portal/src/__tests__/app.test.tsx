import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '@/App';

// jsdom: <dialog> sin showModal y sin ResizeObserver (recharts).
beforeEach(() => {
  window.location.hash = '#/';
  sessionStorage.clear();
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

describe('portal en modo demo (sin Supabase configurado)', () => {
  it('muestra el panel con KPIs y clientes que necesitan atención', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Panel' })).toBeInTheDocument();
    expect(screen.getByText('Clientes activos')).toBeInTheDocument();
    expect(screen.getByText('Necesitan atención')).toBeInTheDocument();
    expect(screen.getAllByText('Lucía Morales').length).toBeGreaterThan(0);
  });

  it('lista, filtra y crea un cliente (queda pendiente para el teléfono)', async () => {
    window.location.hash = '#/clientes';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtrar clientes' })).getByRole('button', { name: /^Inactivos/ }));
    const table = screen.getByRole('table');
    expect(within(table).getByText('Lucía Morales')).toBeInTheDocument();
    expect(within(table).queryByText('Mateo Herrera')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Nuevo cliente/ }));
    fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: 'Nueva Clienta' } });
    fireEvent.change(screen.getByLabelText('Grasa visceral'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Grasa visceral entre 1 y 59')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Grasa visceral'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/clientes\/local-/));
    expect(await screen.findByRole('heading', { name: 'Nueva Clienta' })).toBeInTheDocument();
    expect(screen.getByText(/1 cambio del portal pendiente/)).toBeInTheDocument();
  });
});
