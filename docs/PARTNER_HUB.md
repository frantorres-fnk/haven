# HAVEN Partner Hub V1

Capa multicliente para partners (MSP/MSSP, revendedores, consultoras) que operan HAVEN
para sus clientes. **No es un clon de FENIKSO Admin**: un Partner ve y opera solo sus
clientes; FENIKSO sigue siendo el control plane (capacidad, vigencia, asociaciones).

```
FENIKSO Admin (/admin)        control plane: crea Partners, asocia orgs, aprueba solicitudes
   └── Partner (/partner)     opera SUS clientes: dashboard, detalle, trials, solicitudes
         └── Cliente          organization HAVEN normal, con su Tenant Portal (/dashboard)
```

## Modelo

**PARTNER != ORGANIZATION.** Entidades separadas (migración `20261030120000_partner_hub.sql`):

| Tabla | Qué guarda | Reglas |
|---|---|---|
| `partners` | Partner + branding liviano (`display_name`, `logo_path`, `accent_color`, `support_email`, `support_name`) | `status` active / suspended / inactive · `slug` único · `accent_color` solo `#RRGGBB` · `logo_path` solo `<partner_id>/logo-<uuid>.(png\|jpg\|webp)` dentro de la carpeta del propio Partner |
| `partner_users` | Membresía usuario Auth → Partner, con rol | unique `(partner_id, user_id)` (el modelo admite varios Partners por usuario) · **V1: un solo Partner ACTIVO por usuario** (unique parcial) · FK a `auth.users` on delete cascade |
| `partner_invites` | Invitaciones | solo `token_hash` (SHA-256), nunca el token · vencen a los 7 días · una pendiente por (Partner, email) |
| `partner_organizations` | Partner → organization | `relationship_type` managed / referred · **máx. un Partner ACTIVO por org** (unique parcial) · desasociar = `status inactive` + `ended_at` (queda historial) |
| `capacity_requests` | Pedidos de capacidad | `requested_limit > current_limit`, ≤ 1000 · una pendiente por org |
| `partner_service_requests` | Extensión de trial / activación | una pendiente por (org, tipo) · snapshot de la vigencia al pedir |
| `partner_actions` | Auditoría del lado Partner | sin FK a la org (sobrevive a su borrado) |

Todas: RLS activado, **sin policies y sin grants para `anon`/`authenticated`**; solo
`service_role` (Worker). Mismo patrón que `credential_exposures` / `trial_closure_reports`.
No hay funciones `SECURITY DEFINER` nuevas. Las tablas nacen vacías: no se crea ni asocia
ningún Partner en la migración.

## Roles (matriz V1)

| Permiso | owner | admin | analyst | sales |
|---|:-:|:-:|:-:|:-:|
| `clients.read` — dashboard, resumen, dominios, conteos | ✓ | ✓ | ✓ | ✓ |
| `clients.create` — nuevo cliente (trial) | ✓ | ✓ | | ✓ |
| `technical.read` — detalle de hallazgos, identidades de credenciales, reportes | ✓ | ✓ | ✓ | |
| `requests.create` — capacidad / extensión / activación | ✓ | ✓ | | ✓ |
| `team.manage` — ver/invitar/cambiar rol/desactivar | ✓ | ✓ | | |
| `branding.manage` | ✓ | ✓ | | |

Reglas extra de equipo: solo un **owner** invita o gestiona owners; nadie se modifica a sí
mismo; siempre queda al menos un owner activo. Desactivar un miembro no borra su usuario Auth.

`sales` ve "33 credenciales expuestas" y conteos por severidad, nunca identidades ni
títulos de hallazgos: el Worker ni siquiera pide esas columnas a la base para ese rol.

## Autorización

Única entrada: `handlePartnerRequest()` (`haven-workers/scanner/src/partner.js`). Toda ruta
`/partner/*` pasa por:

1. **`verifyPartner()`**: Bearer → GoTrue valida firma + sesión (`/auth/v1/user`) ·
   contraseña temporal (`passwordGate`) · claims del **mismo** token (`sub` = usuario) ·
   membresía **activa** en `partner_users` (DB; nunca `user_metadata`/`app_metadata`) ·
   Partner **activo** · sesión **aal2**. Devuelve `{ userId, email, partnerId, role, partner }`.
2. Permiso del rol para la ruta (`PARTNER_ROUTES` → `PERMISSIONS`).
3. **`verifyPartnerOrgAccess()`** para toda ruta con organización: busca la relación
   **activa** con el `partner_id` **de la sesión**. "No existe", "es de otro Partner", "fue
   desasociada" y "no es un UUID" devuelven el mismo `404 client_not_found`.

`partner_id` nunca se lee del request. Errores: `401` token · `403 not_partner` /
`partner_suspended` / `partner_inactive` / `mfa_required` / `forbidden_role` · `404 client_not_found`.

Las rutas de gestión (`/admin/partners*`, `/admin/capacity-requests/*`,
`/admin/service-requests/*`) usan `verifyAdmin()` (admin_users + aal2) y están cubiertas por
la auditoría automática de `admin-mfa.spec.js`. Un token Partner contra `/admin/*` → 403; un
token tenant contra `/partner/*` → 403.

### MFA

Obligatorio (aal2) para **todos** los roles Partner. Reutiliza el flujo TOTP del Admin
(`src/components/AdminMfa.jsx`, `src/lib/adminMfa.js`, factor "HAVEN Partner Hub").
Recuperación del autenticador: igual que Admin (`docs/ADMIN_MFA.md`).

### Sin impersonación

No existe "entrar como cliente". El Partner nunca recibe una sesión o token del tenant,
nunca ve la contraseña del owner del cliente y no puede cambiarla. Las vistas de cliente se
arman en el Worker con service key **solo después** de verificar Partner + relación.

## Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/partner/me` | clients.read |
| GET | `/partner/dashboard` (KPIs + clientes) | clients.read |
| POST | `/partner/organizations` (trial) | clients.create |
| GET | `/partner/organizations/:id` · `/domains` · `/findings` · `/credentials` | clients.read (+ relación) |
| GET | `/partner/organizations/:id/reports` | technical.read (+ relación) |
| GET | `/partner/requests` | clients.read |
| POST | `/partner/capacity-requests` · `/partner/capacity-requests/:id/cancel` | requests.create |
| POST | `/partner/service-requests` · `/partner/service-requests/:id/cancel` | requests.create |
| GET/POST/PUT | `/partner/team` · `/partner/team/invite` · `/partner/team/:id` · `/partner/team/invites/:id/revoke` | team.manage |
| GET | `/partner/branding` | clients.read |
| PUT/DELETE | `/partner/branding` · `/partner/branding/logo` | branding.manage |
| GET/POST | `/partner-invites/info` · `/partner-invites/accept` | token de invitación (+ JWT para aceptar) |
| GET | `/account/managed-by` | tenant (verifyJWT): "Gestionado por" de su propia org |

Admin: `GET/POST /admin/partners`, `PUT /admin/partners/:id`,
`POST /admin/partners/:id/invites`, `POST /admin/partners/:id/invites/:inviteId/revoke`,
`PUT /admin/partners/:id/users/:memberId`, `POST /admin/partners/:id/organizations`,
`DELETE /admin/partners/:id/organizations/:orgId`, `POST /admin/capacity-requests/:id/review`,
`POST /admin/service-requests/:id/review`.

## Provisioning (trial controlado)

`POST /partner/organizations` reutiliza `provisionTenant()` (el mismo de "+ Crear cliente"),
con opciones de Partner:

- vigencia **siempre** trial de 1–7 días (default 7, inicio hoy, fin inclusive);
- `domain_limit = 6` explícito;
- `contract`, `manual`, fechas, `domain_limit`, `plan`, `status` en el body → **403**
  `not_allowed_for_partner` (lo decide FENIKSO);
- owner nuevo **sin contraseña temporal**: contraseña aleatoria que nadie conoce + link de
  recuperación de Supabase Auth (`/reset-password`). Un email que **ya tiene cuenta HAVEN**
  no puede ser owner de un alta del Partner (sería asignarle una org sin su consentimiento):
  eso lo hace FENIKSO;
- dominio / nombre / email en uso → **un único `409 client_conflict` genérico** (sin oráculo
  de qué existe en HAVEN);
- tope anti-abuso: **20 altas por Partner cada 24 h** (`429 client_quota_exceeded`);
- la relación `partner_organizations` (managed, Partner de la sesión) se crea dentro del
  alta; si falla, el alta se compensa entera (org + usuario creado);
- idempotencia: si el dominio ya existe, solo se devuelve el cliente si **ya es de este
  Partner**; si no, `409 domain_taken` sin datos de la otra org;
- auditoría `partner_actions.partner_created_client`. Bienvenida co-branded.

El Partner no puede extender, convertir, poner sin vencimiento ni reactivar: "Solicitar
extensión / activación".

## Solicitudes

- **Capacidad** (`capacity_requests`): el Partner pide (ej. 6 → 25); `domain_limit` **no
  cambia**. FENIKSO aprueba con `admin_review_capacity_request()`, que en una sola
  transacción bloquea la solicitud y llama a **`admin_set_domain_limit()`** (mismo mecanismo
  y lock que Tenant Capacity V1). Nunca baja la capacidad (si ya alcanza lo pedido, aprueba
  sin cambios). Auditoría admin: `capacity_changed` (`source: capacity_request`) +
  `capacity_request_approved|rejected`.
- **Servicio** (`partner_service_requests`): `trial_extension` (solo clientes en trial) o
  `activation`. Aprobar **solo registra la decisión** (y exige que el Partner siga gestionando la org); FENIKSO aplica la vigencia con el
  flujo existente ("Vigencia" / `PUT /admin/organizations/:id/service`).
- El Partner ve el estado y puede cancelar sus pendientes.
- Las solicitudes no sobreviven a un cambio de Partner: desasociar cancela las pendientes de
  ese Partner sobre la org, y aprobar exige relación activa (`409 relation_inactive`).

## Branding / co-branding

Configurable: nombre visible, logo, color de acento, email de soporte. El nombre no admite
caracteres de control y un Partner no puede usar "HAVEN" ni "FENIKSO" en él (anti-suplantación;
FENIKSO Admin sí puede fijarlo). **"Powered by HAVEN"
siempre visible.** Sin custom domain, favicon, CSS, fonts, HTML ni templates.

- **Logo**: bucket público de Storage `partner-branding` (solo assets de marca; los emails
  necesitan URL pública). `Content-Length` obligatorio (411 sin él). Solo el Worker escribe (service key; sin policies para el
  cliente). PNG/JPG/WEBP por magic bytes + Content-Type coincidente, ≤ 512 KB. **SVG no se
  acepta en V1** (sin sanitización confiable en Workers). Path generado por el Worker; el
  anterior se borra.
- **Accent**: solo `#RRGGBB` (Worker + CHECK en DB). En el Hub se aplica únicamente como
  variable CSS `--pa` (botones, bordes, pestaña activa); valor inválido → accent de HAVEN.
- **Emails** de clientes gestionados por un Partner **activo** (bienvenida, avisos de
  vigencia, informe de cierre de trial, reporte mensual): franja `[logo] Partner · Powered by
  HAVEN` + "Soporte: `support_email`" (fallback `hola@fenikso.io`). Remitente técnico sin
  cambios (`noreply@fenikso.io`); sin SPF/DKIM del Partner. La copia interna a FENIKSO no
  lleva co-branding. Sin Partner o con error al leerlo → template HAVEN normal.
- **Reportes**: mismo motor; la vista de reportes del Hub muestra la marca del Partner.
- **Tenant Portal**: identificación discreta "Gestionado por [Partner] · Powered by HAVEN"
  en el header del dashboard.

## Equipo e invitaciones

Invitación con token (256 bits, solo el hash en la DB, 7 días). **Sin contraseñas por
email.** El invitado abre `/partner/accept-invite`, entra con su cuenta o la crea (Supabase
Auth), y acepta: el Worker exige email de la sesión = email invitado, Partner activo y que el
usuario no esté activo en otro Partner (V1), con email confirmado. Una invitación nunca
cambia el rol de una membresía **activa** (solo reactiva una inactiva). Desactivar a alguien
revoca sus invitaciones pendientes; un admin no revoca invitaciones de owner. Después, el Hub
exige MFA.
FENIKSO puede invitar cualquier rol (incluido owner) y desactivar usuarios Partner.

## Suspensión y desasociación

- `partners.status = suspended` (o `inactive`): los usuarios Partner no entran al Hub.
  **Los clientes no cambian**: ni org, ni tenant, ni monitoreo, ni vigencia. Los emails
  dejan de llevar su marca mientras esté suspendido.
- Desasociar (FENIKSO): cierra la relación → el Partner pierde acceso en el siguiente
  request. No borra ni modifica la organization, su tenant, monitoreo ni datos.
- El owner del cliente siempre conserva su acceso propio al Tenant Portal.

## Auditoría

- `partner_actions`: `partner_created_client`, `partner_invited_user`,
  `partner_changed_branding`, `capacity_requested`, `service_requested`,
  `*_request_cancelled`, `partner_changed_member`, `partner_revoked_invite`,
  `partner_user_joined`, y las acciones de FENIKSO sobre el Partner
  (`partner_created`, `partner_status_changed`, `organization_associated|disassociated`).
- `admin_actions` (FENIKSO): `partner_created`, `partner_status_changed`, `partner_updated`,
  `partner_user_invited|updated`, `partner_invite_revoked`, `partner_associated`,
  `partner_disassociated`, `capacity_changed`, `capacity_request_approved|rejected`,
  `service_request_approved|rejected`. Las acciones sin org usan `org_id = null`.

## Frontend

`/partner` (login propio), `/partner/dashboard`, `/partner/clients`,
`/partner/clients/:organizationId`, `/partner/requests`, `/partner/team`,
`/partner/branding`, `/partner/accept-invite`. Código en `src/pages/partner/`,
`src/lib/partner.js`; Admin: pestaña **Partners** (`src/components/AdminPartners.jsx`).
El frontend es solo UX: la autoridad es el Worker.

## Tests

- DB (PGlite): `supabase/tests/partner-hub-db.test.js`.
- Worker: `src/__tests__/partner-hub.spec.js` (incluye auditoría automática de todas las rutas
  de `PARTNER_ROUTES`: sin token 401, tenant 403, aal1 403, suspendido 403, sin escrituras) y
  `admin-mfa.spec.js` (las 10 rutas admin nuevas exigen aal2).
- Portal: `src/__tests__/partner-hub.test.jsx`.

## Deploy

1. `PARTNER_HUB_PRECHECK.sql` (fuera del repo) → todo `ok`.
2. Migración `20261030120000_partner_hub.sql`. Si el bucket no se pudo crear (WARNING),
   crearlo a mano: Storage → New bucket `partner-branding`, **public**, 512 KB,
   `image/png, image/jpeg, image/webp`, sin policies.
3. `PARTNER_HUB_POSTCHECK.sql` → todo `ok`.
4. Worker: `npx wrangler deploy`.
5. Frontend: `git push origin main`.
6. Smoke con entidades descartables (`ZZ PARTNER SMOKE`, `ZZ CLIENT PARTNER SMOKE`) →
   `PARTNER_HUB_SMOKE_VERIFY.sql` → `PARTNER_HUB_SMOKE_CLEANUP.sql`.

## Límites V1 (fuera de alcance)

Billing/comisiones/invoices/payouts, capacity pool, custom domains, full white-label,
favicon por Partner, impersonación, jerarquías de distribuidores, API pública, marketplace,
multi-partner ownership de una org, usuario activo en más de un Partner.

## Extensiones futuras

Pool de capacidad por Partner (llamaría a `admin_set_domain_limit`), varios Partners por
usuario (selector de Partner en la sesión), notificación por email a FENIKSO/Partner al
crear/resolver solicitudes, audiencia `partner` en `service_lifecycle_notifications` (ya
prevista en el CHECK), sender/dominio propio del Partner, aplicar la vigencia directamente
al aprobar una solicitud de servicio.
