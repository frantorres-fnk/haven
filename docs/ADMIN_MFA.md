# HAVEN Admin — MFA (TOTP) obligatorio

Aplica **solo** al portal FENIKSO Admin (`/admin`) y a los endpoints `/admin/*` del
Worker. El portal de clientes (tenant) no cambia: MFA no es obligatorio para clientes.

## Flujo

1. Email + contraseña (Supabase Auth) → sesión **aal1**.
2. El portal consulta `GET /admin/data`:
   - `403 { error: "mfa_required" }` → es admin, falta el segundo factor.
   - `403` / `401` con otro error → no es admin: se cierra la sesión ("No tenés permisos de administrador").
3. Segundo factor (`supabase.auth.mfa.*`, APIs oficiales):
   - **Sin factor TOTP verificado** → enrolamiento obligatorio: `enroll({ factorType: 'totp', friendlyName: 'HAVEN Admin' })`,
     QR + secret entregados por Supabase, código de 6 dígitos → `challenge` + `verify`.
     Antes de enrolar se eliminan (`unenroll`) los factores TOTP **sin verificar** (enrolamientos abandonados).
     Nunca se tocan factores verificados ni se crea uno nuevo si ya existe uno.
   - **Con factor verificado** → "Verificación en dos pasos": `challenge` + `verify` sobre un factor **verificado**
     (si hay varios, el admin elige).
4. Después de `verify`, `getAuthenticatorAssuranceLevel()` debe dar `currentLevel === 'aal2'`
   (si no, `refreshSession()` y se vuelve a comprobar). Recién entonces se vuelve a pedir `/admin/data` y se muestra el Admin.
5. Recarga del navegador: con sesión existente se repite todo el guard (aal1 → MFA, aal2 → Admin).

Código: `src/lib/adminMfa.js`, `src/components/AdminMfa.jsx`, guard en `src/pages/Admin.jsx`.
El Admin no se renderiza antes de tener **admin autorizado por el Worker + aal2**.

## Requisito aal2 en el Worker (la autoridad)

`verifyAdmin()` (`haven-workers/scanner/src/index.js`) es el único punto de entrada de los 17 handlers `/admin/*`:

1. Bearer → `GET /auth/v1/user` en GoTrue (valida firma y sesión del token), como antes.
2. Contraseña temporal pendiente (`passwordGate`), como antes.
3. `admin_users` por email, como antes (la autorización no cambió).
4. Claim `aal` del **mismo** token que GoTrue acaba de aceptar (y `sub` igual al usuario validado):
   solo `aal2` pasa. Admin en aal1 → `403 { ok: false, error: "mfa_required" }`.

El test `src/__tests__/admin-mfa.spec.js` extrae del router todas las rutas `/admin/*` y verifica que cada una
rechaza aal1. Si se agrega un endpoint admin, tiene que usar `verifyAdmin()` o el test falla.

## Cómo verificar que una sesión Admin está en aal2

- En el portal (consola del navegador, sesión del admin):
  `await supabase.auth.mfa.getAuthenticatorAssuranceLevel()` → `currentLevel: 'aal2'`.
- Contra el Worker: `GET /admin/data` con el access token → `200` (aal2) o `403 mfa_required` (aal1).
- El access token (JWT) de una sesión aal2 trae `"aal": "aal2"` y `amr` con `totp`.

## Pérdida del autenticador (recuperación manual)

No hay recuperación automática en V1 (intencional): ni "olvidé mi MFA", ni bypass por email, ni códigos de respaldo propios.

1. Confirmar la identidad del admin por un canal independiente (no por el mismo email).
2. Alguien con acceso al proyecto Supabase elimina **el factor** del usuario:
   Dashboard → Authentication → Users → el usuario → eliminar el factor MFA,
   o Admin API con service role: `DELETE /auth/v1/admin/users/{user_id}/factors/{factor_id}`
   (`supabase.auth.admin.mfa.deleteFactor`).
3. Revocar sus sesiones si corresponde.
4. En el próximo ingreso el admin vuelve a ver el enrolamiento obligatorio.

No se modifica `admin_users` ni la cuenta: solo se borra el factor.

## Qué NO hacer

- No agregar variables o flags de bypass (`MFA_BYPASS`, listas de excepción, "modo mantenimiento").
- No quitar ni condicionar el chequeo `aal2` de `verifyAdmin()`, ni crear endpoints `/admin/*` que no lo usen.
- No usar el frontend como enforcement (el guard es UX; la autoridad es el Worker).
- No guardar secrets TOTP, QR ni códigos (ni en la base, ni en localStorage, ni en logs, ni en Sentry).
- No marcar "MFA completo" en storage propio: el estado sale siempre de Supabase (`getAuthenticatorAssuranceLevel`).
- No permitir desactivar MFA desde la UI Admin.
- No exigir MFA a clientes ni tocar el login tenant / RLS para esto.
