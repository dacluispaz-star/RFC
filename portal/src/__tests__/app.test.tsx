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
  it('crea un plan de alimentación, añade un alimento y lo guarda', async () => {
    window.location.hash = '#/planes';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Planes de alimentación' })).toBeInTheDocument();
    expect(screen.getByText('Definición · Fase 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Nuevo plan/ }));
    fireEvent.change(screen.getByLabelText('Nombre del plan'), { target: { value: 'Plan test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/planes\/.+/));
    const name = (await screen.findByLabelText('Nombre del plan', {}, { timeout: 5000 })) as HTMLInputElement;
    expect(name.value).toBe('Plan test');

    fireEvent.click(screen.getAllByRole('button', { name: /Alimento/ })[0]);
    fireEvent.change(await screen.findByLabelText('Buscar alimento'), { target: { value: 'avena' } });
    fireEvent.click(screen.getByRole('button', { name: /^Avena\s*Cereales/ }));
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a la comida' }));
    fireEvent.click(screen.getByRole('button', { name: /Listo/ }));
    expect(screen.getByLabelText('Gramos de Avena')).toHaveValue(40);
    expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/Guardado\. Llegará a la app/)).toBeInTheDocument();
    expect(screen.getByText('Todo guardado')).toBeInTheDocument();
  });
});
