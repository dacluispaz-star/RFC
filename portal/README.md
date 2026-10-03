# Portal web de clientes (RFC)

Portal de escritorio para ver, crear y editar clientes y revisar su analítica:
composición corporal, actividad y adherencia, nutrición y vencimientos del
servicio. No incluye funciones de entrenamiento.

Usa **la misma cuenta de Supabase que la app**: lee la copia en la nube
(`user_backups`) que sube el teléfono y guarda tus cambios en una cola
(`portal_changes`). La app aplica esa cola la próxima vez que se abre (o vuelve
a primer plano) con conexión, así que el teléfono no sobrescribe lo que editas
en el portal.

## 1. Preparar Supabase (una sola vez)

En Supabase → **SQL Editor**, ejecuta en este orden:

1. `supabase/migrations/20260930120000-body-composition.sql` (si aún no lo hiciste)
2. `supabase/migrations/20261003120000-portal-changes.sql`

Sin el segundo script el portal funciona, pero solo en lectura.

Instala también la nueva versión de la app en el teléfono: es la que sabe
aplicar los cambios del portal.

## 2. Ejecutar en local

```bash
cd portal
cp .env.example .env      # pon la misma URL y anon key que usa la app
npm install --legacy-peer-deps
npm run dev               # http://localhost:5173
```

Entra con el correo y la contraseña de tu cuenta de la app.

Para verlo sin conectar nada: abre `http://localhost:5173/?demo` o pulsa
**«Ver con datos de ejemplo»** en el login. Los datos de ejemplo viven solo en
memoria.

## 3. Publicar en Vercel (recomendado)

1. Sube el repositorio a GitHub (si no lo está).
2. En Vercel → **Add New Project** → importa el repo.
3. **Root Directory:** `portal`. Vercel detecta Vite solo. En *Install Command* pon `npm install --legacy-peer-deps`.
4. **Environment Variables:** `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Deploy.

En Netlify funciona igual: Base directory `portal` (ya hay un `netlify.toml`).

Recomendado: en Supabase → Authentication → URL Configuration, añade la URL del
portal a *Redirect URLs*.

## Cómo se sincroniza

| Acción | Dónde se ve |
| --- | --- |
| Editas en el portal | Al instante en el portal (marcado como «pendiente») |
| La app se abre con conexión | Aplica los cambios y sube una copia nueva |
| Editas en el teléfono | En el portal tras su siguiente subida + «Actualizar» |

Si editas el mismo campo en ambos sitios antes de que el teléfono sincronice,
gana el cambio del portal.

## Scripts

- `npm run dev`: servidor de desarrollo
- `npm run build`: comprobación de tipos y build de producción en `dist/`
- `npm test`: tests
