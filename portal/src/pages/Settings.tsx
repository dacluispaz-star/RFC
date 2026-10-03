import { useEffect, useRef, useState } from 'react';
import { useData } from '@/lib/data';
import { Button, Card, Field } from '@/components/ui';
import { IconImage, IconTrash } from '@/components/icons';

const MAX_LOGO_BYTES = 200 * 1024; // mismo límite que la app

/** Reduce la imagen a ≤ 256 px y la devuelve como dataURL (PNG si cabe, si no JPEG). */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen.');
    ctx.drawImage(img, 0, 0, w, h);
    let out = canvas.toDataURL('image/png');
    if (out.length > MAX_LOGO_BYTES) {
      const flat = document.createElement('canvas');
      flat.width = w;
      flat.height = h;
      const fctx = flat.getContext('2d');
      if (!fctx) throw new Error('No se pudo procesar la imagen.');
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, w, h);
      fctx.drawImage(canvas, 0, 0);
      out = flat.toDataURL('image/jpeg', 0.88);
    }
    if (out.length > MAX_LOGO_BYTES) throw new Error('El logo es demasiado grande incluso reducido. Prueba con otra imagen.');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SettingsPage() {
  const { branding, saveBranding, mode } = useData();
  const [logo, setLogo] = useState<string | null>(branding.logoUrl);
  const [contact, setContact] = useState(branding.contactInfo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogo(branding.logoUrl);
    setContact(branding.contactInfo);
  }, [branding]);

  const dirty = logo !== branding.logoUrl || contact.trim() !== branding.contactInfo;

  const onFile = async (f?: File) => {
    if (!f) return;
    setMsg(null);
    try {
      setLogo(await fileToLogoDataUrl(f));
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'No se pudo usar la imagen' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await saveBranding({ logoUrl: logo, contactInfo: contact.trim() });
      setMsg({ tone: 'good', text: mode === 'demo' ? 'Guardado (solo en esta demo).' : 'Guardado. Se usará en los PDF que descargues desde el portal.' });
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'No se pudo guardar' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Ajustes</h1>
        <p className="text-sm text-ink-3 mt-1">Marca de los PDF del portal. La app del teléfono mantiene su propia configuración.</p>
      </header>

      <Card title="Marca del PDF" subtitle="Aparece en la cabecera y el pie del plan de alimentación">
        <div className="space-y-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl border border-line bg-white flex items-center justify-center overflow-hidden shrink-0">
              {logo ? <img src={logo} alt="Logo actual" className="max-w-[68px] max-h-[68px] object-contain" /> : <img src="/favicon.png" alt="Logo de RFC (por defecto)" className="max-w-[56px] max-h-[56px] object-contain opacity-80" />}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-ink-2">{logo ? 'Tu logo' : 'Sin logo propio: se usa el de RFC'}</p>
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} id="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
                <Button size="sm" onClick={() => fileRef.current?.click()}><IconImage size={14} /> {logo ? 'Cambiar logo' : 'Subir logo'}</Button>
                {logo && <Button size="sm" variant="ghost" onClick={() => setLogo(null)}><IconTrash size={14} /> Quitar</Button>}
              </div>
              <p className="text-xs text-ink-3">PNG o JPG. Se reduce automáticamente.</p>
            </div>
          </div>
          <Field
            label="Datos de contacto"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={120}
            placeholder="Ej.: Tu nombre · teléfono · @instagram"
            hint="Se imprime en el pie del PDF."
          />
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={() => void save()} disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Guardar'}</Button>
            {msg && <p role={msg.tone === 'bad' ? 'alert' : 'status'} className={msg.tone === 'bad' ? 'text-sm text-bad' : 'text-sm text-good'}>{msg.text}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}
