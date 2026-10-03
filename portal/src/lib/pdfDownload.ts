import type { Branding, MealPlan } from './types';

export function planPdfFilename(planName: string, date: Date = new Date()): string {
  // Mismo nombre que la app al descargar.
  const safe =
    planName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Plan';
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `Plan-${safe}-${d}.pdf`;
}

/** Genera el PDF (mismo diseño que la app) y lo descarga. */
export async function downloadPlanPdf(plan: MealPlan, clientName: string | undefined, branding: Branding): Promise<void> {
  const { generateNutritionPlanPDF } = await import('./planPdf');
  const blob = await generateNutritionPlanPDF(plan, clientName || undefined, branding);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = planPdfFilename(plan.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
