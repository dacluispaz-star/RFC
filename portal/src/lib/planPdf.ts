// PDF del plan de alimentación: COPIA del generador de la app
// (src/utils/pdfGenerator.ts → buildPlanHTML + containerHtmlToPdfBlob) para
// que el PDF del portal sea idéntico al del teléfono. Si cambias el diseño en
// la app, copia aquí la misma función.

import type { Branding, MealPlan, MealPlanDay, MealPlanItem } from './types';

// Mismo logo que la app (copia en portal/public). Si falta, usa el favicon.
const APP_LOGO_PATHS = ['/logo-personal-training.png', '/favicon.png'];

let _appLogoDataUrl: string | null = null;
async function getAppLogoDataUrl(): Promise<string> {
  if (_appLogoDataUrl) return _appLogoDataUrl;
  let blob: Blob | null = null;
  for (const path of APP_LOGO_PATHS) {
    try {
      const res = await fetch(path);
      if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) {
        blob = await res.blob();
        break;
      }
    } catch {
      // probar el siguiente
    }
  }
  if (!blob) return '';
  _appLogoDataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  return _appLogoDataUrl;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function calcTotals(items: MealPlanItem[]) {
  return items.reduce(
    (a, i) => ({
      calories: a.calories + i.calories,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES');

/**
 * Plantilla "claro esmeralda" (Opción A del rediseño):
 * cabecera con marca + tarjeta de kcal/macros, cuadrícula semanal
 * (filas = comidas, columnas = días), lista de la compra con casillas y
 * resumen semanal. Solo estilos inline hex (compatible html2canvas).
 */
async function buildPlanHTML(
  plan: MealPlan,
  clientName: string | undefined,
  branding: Branding
): Promise<string> {
  const NAVY = '#0F2A44';
  const EMERALD = '#059669';
  const EMERALD_DARK = '#047857';
  const EMERALD_TEXT = '#065F46';
  const MINT = '#ECFDF5';
  const AMBER = '#F59E0B';
  const INK = '#1E293B';
  const MUTED = '#64748B';
  const FONT = "Manrope, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const dayTotals = plan.days.map((d) =>
    d.meals.reduce(
      (a, m) => {
        const t = calcTotals(m.items);
        return {
          calories: a.calories + t.calories,
          protein: a.protein + t.protein,
          carbs: a.carbs + t.carbs,
          fat: a.fat + t.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
  );
  const totalGral = dayTotals.reduce(
    (a, t) => ({
      calories: a.calories + t.calories,
      protein: a.protein + t.protein,
      carbs: a.carbs + t.carbs,
      fat: a.fat + t.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const numDays = plan.days.length;
  const avgCalories = numDays > 0 ? Math.round(totalGral.calories / numDays) : 0;
  const avgProtein = numDays > 0 ? Math.round(totalGral.protein / numDays) : 0;
  const avgCarbs = numDays > 0 ? Math.round(totalGral.carbs / numDays) : 0;
  const avgFat = numDays > 0 ? Math.round(totalGral.fat / numDays) : 0;

  const totalCalFromMacros = totalGral.protein * 4 + totalGral.carbs * 4 + totalGral.fat * 9;
  const pPct = totalCalFromMacros > 0 ? Math.round((totalGral.protein * 4 * 100) / totalCalFromMacros) : 0;
  const cPct = totalCalFromMacros > 0 ? Math.round((totalGral.carbs * 4 * 100) / totalCalFromMacros) : 0;
  const gPct = totalCalFromMacros > 0 ? Math.max(0, 100 - pPct - cPct) : 0;

  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Orden de comidas: unión en orden de aparición.
  const mealOrder: string[] = [];
  plan.days.forEach((d) =>
    d.meals.forEach((m) => {
      if (!mealOrder.includes(m.name)) mealOrder.push(m.name);
    })
  );

  const dayByName = (day: MealPlanDay, mealName: string) =>
    day.meals.find((m) => m.name === mealName);

  // kcal medias por comida (solo días donde la comida tiene alimentos).
  const mealAvgKcal = (mealName: string): number => {
    const vals = plan.days
      .map((d) => dayByName(d, mealName))
      .filter((m): m is { name: string; items: MealPlanItem[] } => !!m && m.items.length > 0)
      .map((m) => calcTotals(m.items).calories);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const cellLines = (meal: { items: MealPlanItem[] } | undefined): string => {
    if (!meal || meal.items.length === 0)
      return `<div style="font-size:11.5px;color:#CBD5E1;">—</div>`;
    return meal.items
      .map(
        (i) =>
          `<div style="display:flex;justify-content:space-between;gap:6px;font-size:11.5px;line-height:1.35;margin:0 0 3px;"><span style="font-weight:600;color:${INK};">${escapeHtml(i.food_name)}</span>${i.grams > 0 ? `<span style="font-weight:700;color:${MUTED};white-space:nowrap;">${Math.round(i.grams)} g</span>` : ''}</div>`
      )
      .join('');
  };

  // Lista de la compra: agrega gramos por alimento en todo el plan.
  const shopping = new Map<string, number>();
  plan.days.forEach((d) =>
    d.meals.forEach((m) =>
      m.items.forEach((i) => {
        shopping.set(i.food_name, (shopping.get(i.food_name) ?? 0) + i.grams);
      })
    )
  );
  const shoppingEntries = [...shopping.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'es')
  );
  const fmtQty = (g: number) =>
    g >= 1000 ? `${(g / 1000).toFixed(1).replace('.', ',')} kg` : `${Math.round(g)} g`;
  const SHOP_COLS = 4;
  const perCol = Math.max(1, Math.ceil(shoppingEntries.length / SHOP_COLS));
  let shoppingColsHTML = '';
  for (let c = 0; c < SHOP_COLS; c++) {
    const slice = shoppingEntries.slice(c * perCol, (c + 1) * perCol);
    shoppingColsHTML += `<div style="display:flex;flex-direction:column;gap:3px;">${slice
      .map(
        ([name, g]) =>
          `<div style="display:flex;align-items:center;gap:7px;font-size:11px;line-height:1.3;"><span style="width:9px;height:9px;border-radius:3px;border:1.5px solid #94A3B8;flex-shrink:0;"></span><span style="flex-grow:1;font-weight:600;color:${INK};">${escapeHtml(name)}</span>${g > 0 ? `<span style="font-weight:700;color:${MUTED};white-space:nowrap;">${fmtQty(g)}</span>` : ''}</div>`
      )
      .join('')}</div>`;
  }
  if (shoppingEntries.length === 0) {
    shoppingColsHTML = `<div style="font-size:11px;color:${MUTED};">Sin alimentos en el plan.</div>`;
  }

  const appLogo = await getAppLogoDataUrl();
  const logoSrc = branding.logoUrl || appLogo;
  const logoHTML = `<div style="width:64px;height:64px;border-radius:18px;background:#FFFFFF;border:1px solid #E2E8F0;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;"><img src="${escapeHtml(logoSrc)}" style="max-width:56px;max-height:56px;object-fit:contain;" /></div>`;

  const gridCols = `128px repeat(${Math.max(numDays, 1)}, minmax(0, 1fr))`;

  const dayHeaders = plan.days
    .map(
      (d, i) =>
        `<div style="padding:8px 12px;border-radius:12px;background:${NAVY};color:#FFFFFF;display:flex;justify-content:space-between;align-items:baseline;gap:6px;"><span style="font-size:13px;font-weight:800;letter-spacing:0.3px;">${escapeHtml(d.name)}</span><span style="font-size:11px;font-weight:700;color:#A7F3D0;white-space:nowrap;">${fmtInt(dayTotals[i].calories)} kcal</span></div>`
    )
    .join('');

  const mealRows = mealOrder
    .map((mealName) => {
      const avg = mealAvgKcal(mealName);
      const label = `<div style="padding:10px 12px;border-radius:12px;background:${MINT};display:flex;flex-direction:column;justify-content:center;gap:2px;"><span style="font-size:13px;font-weight:800;color:${EMERALD_TEXT};">${escapeHtml(mealName)}</span>${avg > 0 ? `<span style="font-size:11px;font-weight:700;color:${EMERALD_DARK};">≈ ${fmtInt(avg)} kcal</span>` : ''}</div>`;
      const cells = plan.days
        .map(
          (d) =>
            `<div style="padding:8px 10px;border-radius:12px;background:#F8FAFC;border:1px solid #EEF2F6;">${cellLines(dayByName(d, mealName))}</div>`
        )
        .join('');
      return label + cells;
    })
    .join('');

  const weekLabel =
    numDays === 7
      ? 'Semana completa'
      : numDays > 0
        ? `${escapeHtml(plan.days[0].name)}${numDays > 1 ? ` – ${escapeHtml(plan.days[numDays - 1].name)}` : ''}`
        : 'Sin días';

  const chip = (text: string, bg: string, color: string) =>
    `<span style="padding:4px 10px;border-radius:999px;background:${bg};color:${color};font-size:12px;font-weight:700;">${text}</span>`;

  const chipsHTML = [
    clientName ? chip(escapeHtml(clientName), MINT, EMERALD_TEXT) : '',
    chip(weekLabel, '#F1F5F9', '#334155'),
    chip(escapeHtml(today), '#F1F5F9', '#334155'),
  ].join('');

  const macroLegend = (color: string, label: string, grams: number, pct: number) =>
    `<div style="display:flex;flex-direction:column;"><span style="font-size:11px;font-weight:700;color:#475569;display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:2px;background:${color};"></span>${label}</span><span style="font-size:15px;font-weight:800;color:${NAVY};">${grams} g <span style="font-size:11px;color:${MUTED};">${pct}%</span></span></div>`;

  const barSeg = (color: string, pct: number, radius: string) =>
    pct > 0 ? `<div style="width:${pct}%;height:10px;background:${color};border-radius:${radius};"></div>` : '';

  const summaryRow = (label: string, value: string) =>
    `<div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:#CBD5E1;">${label}</span><span style="font-weight:800;">${value}</span></div>`;

  const contact = branding.contactInfo?.trim() ?? '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(plan.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${FONT}; color: ${NAVY}; background: #ffffff; width: 1120px; }
</style></head><body>
<div style="width:1120px;padding:36px 40px 24px;display:flex;flex-direction:column;gap:20px;font-family:${FONT};color:${NAVY};background:#FFFFFF;">

  <div style="display:flex;justify-content:space-between;align-items:stretch;gap:24px;">
    <div style="display:flex;gap:18px;align-items:center;">
      ${logoHTML}
      <div style="display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:11px;font-weight:800;letter-spacing:2px;color:${EMERALD_DARK};">PLAN DE ALIMENTACIÓN</span>
        <span style="font-size:32px;font-weight:800;letter-spacing:-0.8px;line-height:1.05;">${escapeHtml(plan.name)}</span>
        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">${chipsHTML}</div>
      </div>
    </div>
    <div style="width:380px;flex-shrink:0;padding:16px 20px;border-radius:20px;background:#F0FDF8;border:1px solid #CDEFE0;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span style="font-size:36px;font-weight:800;letter-spacing:-1px;line-height:1;">${fmtInt(avgCalories)}</span>
        <span style="font-size:13px;font-weight:700;color:#475569;">kcal / día de media</span>
      </div>
      <div style="display:flex;gap:2px;">
        ${barSeg(EMERALD, pPct, '999px 2px 2px 999px')}${barSeg(AMBER, cPct, '2px')}${barSeg(NAVY, gPct, '2px 999px 999px 2px')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:8px;">
        ${macroLegend(EMERALD, 'Proteína', avgProtein, pPct)}
        ${macroLegend(AMBER, 'Carbohidratos', avgCarbs, cPct)}
        ${macroLegend(NAVY, 'Grasas', avgFat, gPct)}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:${gridCols};gap:6px;">
    <div></div>
    ${dayHeaders}
    ${mealRows}
  </div>

  <div style="display:flex;gap:14px;">
    <div style="flex-grow:1;border-radius:18px;border:1px solid #E2E8F0;padding:14px 18px;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:13px;font-weight:800;letter-spacing:0.4px;color:${NAVY};">Lista de la compra</span>
        <span style="font-size:11px;font-weight:600;color:${MUTED};">· cantidades para ${numDays === 1 ? 'el día' : `los ${numDays} días`}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(${SHOP_COLS}, minmax(0, 1fr));gap:4px 20px;">${shoppingColsHTML}</div>
    </div>
    <div style="width:260px;flex-shrink:0;border-radius:18px;background:${NAVY};color:#FFFFFF;padding:16px 18px;display:flex;flex-direction:column;gap:8px;">
      <span style="font-size:11px;font-weight:800;letter-spacing:1.6px;color:#A7F3D0;">RESUMEN DEL PLAN</span>
      ${summaryRow('Energía media', `${fmtInt(avgCalories)} kcal`)}
      ${summaryRow('Proteínas', `${avgProtein} g`)}
      ${summaryRow('Carbohidratos', `${avgCarbs} g`)}
      ${summaryRow('Grasas', `${avgFat} g`)}
      <div style="height:1px;background:rgba(255,255,255,0.14);margin:2px 0;"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:12px;color:#CBD5E1;">Total</span><span style="font-size:20px;font-weight:800;color:#6EE7B7;">${fmtInt(totalGral.calories)} kcal</span></div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:600;color:#94A3B8;border-top:1px solid #EEF2F6;padding-top:10px;">
    <span>${contact ? escapeHtml(contact) : ''}</span>
    <span>Generado con RFC</span>
  </div>
</div>
</body></html>`;
}

async function containerHtmlToPdfBlob(html: string, landscape = true): Promise<Blob> {
  // HTML is 100% self-generated (plan data, client names, branding) — no user
  // input, so DOMPurify is unnecessary and actively harmful: it strips
  // CSS functions like linear-gradient() from inline styles, causing
  // "attempting to parse an unsupported function" errors in jsPDF.
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1120px';
  document.body.appendChild(container);

  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    // A4 horizontal para que quepan los 7 días en columnas.
    const imgWidth = landscape ? 297 : 210; // mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF(landscape ? 'l' : 'p', 'mm', 'a4');
    const pageHeight = landscape ? 210 : 297; // mm
    // Portal: si solo se pasa un poco (≤ 40 %), se reduce para que quepa en
    // una página en vez de cortar el resumen en dos.
    if (imgHeight > pageHeight && imgHeight <= pageHeight * 1.4) {
      const w = (imgWidth * pageHeight) / imgHeight;
      pdf.addImage(imgData, 'JPEG', (imgWidth - w) / 2, 0, w, pageHeight);
      const fitted: Blob = pdf.output('blob');
      if (!fitted || fitted.size === 0) throw new Error('No se pudo generar el PDF (blob vacío)');
      return fitted;
    }
    let y = 0;
    let remaining = imgHeight;
    // First page
    pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
    remaining -= pageHeight;
    while (remaining > 0) {
      y -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
      remaining -= pageHeight;
    }

    const blob: Blob = pdf.output('blob');
    if (!blob || blob.size === 0) {
      throw new Error('No se pudo generar el PDF (blob vacío)');
    }
    return blob;
  } finally {
    document.body.removeChild(container);
  }
}

export async function generateNutritionPlanPDF(
  plan: MealPlan,
  clientName: string | undefined,
  branding: Branding
): Promise<Blob> {
  const html = await buildPlanHTML(plan, clientName, branding);
  return containerHtmlToPdfBlob(html, true);
}
