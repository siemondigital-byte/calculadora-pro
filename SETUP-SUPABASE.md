# Conectar la Calculadora Pro a Supabase (login real + nube)

La app ya viene **Supabase-ready**: el `app.js` tiene cableado el login real, la
carga/guardado en la nube y el control de acceso, todo **protegido** — sin
configuración corre en modo demo (como hoy). Para activarlo son **5 pasos** (~15 min).

> Nada de esto rompe el modo demo: mientras no exista `config.js` con tus llaves,
> la app sigue funcionando igual con `localStorage`.

---

## Paso 1 · Crea el proyecto Supabase
1. En [supabase.com](https://supabase.com) → **New project**.
2. Copia de **Project Settings → API**: el **Project URL** y la **anon public key**
   (la `anon` es pública y va en el navegador; la `service_role` **nunca** se usa aquí).

## Paso 2 · Crea las tablas
Supabase → **SQL Editor** → pega **todo** `supabase-schema.sql` → **Run**.
Crea `usuarios` y `proyectos` con RLS (cada quien ve solo lo suyo), los triggers de
perfil-al-registrarse y `updated_at`.

## Paso 3 · Habilita Auth
Supabase → **Authentication → Providers → Email** → habilítalo. (Si no quieres
confirmación por correo para las cuentas creadas por n8n, desactiva "Confirm email".)

## Paso 4 · Pon tus llaves
Copia `config.example.js` → **`config.js`** y rellena:
```js
window.CRD_CONFIG = {
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU_ANON_KEY_PUBLICA'
};
```
`config.js` ya está en `.gitignore` (no se sube). Súbelo aparte a tu hosting.

## Paso 5 · Carga las librerías en el HTML
En `index.html`, **justo antes** de `<script src="app.js"></script>`, agrega:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="config.js"></script>
<script src="supabase.js"></script>
<script src="app.js"></script>
```
Eso es todo — el `app.js` detecta la config y activa el modo real automáticamente.

---

## Cómo se comporta ya conectado
- **Login**: usa el correo + contraseña reales (los que crea n8n en la compra). Si
  fallan, muestra el error bajo el formulario. Sin config → cualquier dato entra (demo).
- **Carga**: al entrar, trae la *situación* (ingreso/gasto/…) y los *proyectos* del
  usuario desde la nube. Primer login → sube los proyectos de ejemplo.
- **Guardado**: cada cambio se sincroniza (debounced 0.8 s) a `usuarios` y `proyectos`.
- **Logout**: cierra la sesión de Supabase.
- **Auto-login**: si ya hay sesión activa, entra directo.
- **Gating**: si `usuarios.acceso_activo = false` (reembolso), bloquea el acceso.

## Altas, "primeros N" y reembolsos (vía n8n / webhook de compra)
- **Alta**: al comprar, n8n crea el usuario en **Auth** (con correo + contraseña). El
  trigger `on_auth_user_created` crea automáticamente su fila en `usuarios`.
- **Primeros N (gratis de por vida)**: el webhook consulta
  `select count(*) from usuarios where fecha_compra is not null` y, si está dentro del
  cupo, pone `acceso_vitalicio = true` (y `fecha_compra`, `plataforma_compra`).
- **Reembolso**: el webhook pone `acceso_activo = false` → la app bloquea el acceso.
  > Estas escrituras de servidor van con la **service_role key** desde n8n (backend),
  > **no** con la anon key del navegador.

## Despliegue
- **GitHub Pages**: sube todos los archivos (incl. `config.js`) al repo. *(Ojo: en un
  repo público, la anon key queda visible — es aceptable porque es pública y RLS
  protege los datos; si prefieres no exponerla, usa Vercel con variable de entorno.)*
- **Vercel** (recomendado): *Import Git Repository* → deploy. Auto-deploy por push.
  Incluí un `vercel.json` con cabeceras básicas. Para dominio propio: Settings → Domains.

## Archivos de esta capa
- `supabase-schema.sql` — tablas + RLS + triggers.
- `supabase.js` — cliente (auth + datos + gating). Ya referenciado por el paso 5.
- `config.example.js` → cópialo a `config.js` con tus llaves.
- `.gitignore` — evita subir `config.js`.
- `vercel.json` — despliegue opcional.

## Prueba rápida (en la sesión conectada)
1. Crea un usuario de prueba en Supabase → Authentication → Add user.
2. Abre la app, entra con ese correo/contraseña → deberías ver los proyectos de ejemplo.
3. Cambia un valor, recarga → persiste desde la nube.
4. En Supabase, pon `acceso_activo = false` a ese usuario → al reentrar, bloquea.
