import { describe, it, expect } from 'vitest';
import { diffRecord } from '@/lib/data';
import { formToClient, validateClientForm } from '@/components/ClientFormDialog';

describe('formulario de cliente', () => {
  it('convierte números (coma decimal) y vacíos', () => {
    const c = formToClient({ full_name: '  Ana  ', weight_kg: '60,5', visceral_fat_level: '7', bmr_kcal: '', email: '' });
    expect(c).toMatchObject({ full_name: 'Ana', weight_kg: 60.5, visceral_fat_level: 7 });
    expect(c.bmr_kcal).toBeUndefined();
    expect(c.email).toBeUndefined();
  });

  it('valida nombre, correo y rangos', () => {
    const e = validateClientForm({ full_name: '', email: 'x@', visceral_fat_level: '80', bmr_kcal: '1600' });
    expect(Object.keys(e).sort()).toEqual(['email', 'full_name', 'visceral_fat_level']);
    expect(validateClientForm({ full_name: 'Ana', muscle_mass_kg: '25' })).toEqual({});
  });

  it('diff: solo campos cambiados; vaciar = null', () => {
    const prev: Record<string, unknown> = { full_name: 'Ana', weight_kg: 60, phone: '123', bmr_kcal: 1400 };
    const next: Record<string, unknown> = { full_name: 'Ana', weight_kg: 59, phone: undefined, bmr_kcal: 1400 };
    expect(diffRecord(next, prev)).toEqual({ weight_kg: 59, phone: null });
    expect(diffRecord({ full_name: 'Ana', goal: undefined }, null)).toEqual({ full_name: 'Ana' });
  });
});
