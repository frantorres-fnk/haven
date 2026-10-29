# HAVEN — Service Lifecycle V1 (vigencia comercial)

Toda organización tiene una vigencia comercial que solo define **FENIKSO Admin**.

| `service_type` | Fechas | Al vencer |
|---|---|---|
| `trial` | inicio + fin obligatorios | `trialing`/`active` → `trial_ended` |
| `contract` | inicio + fin obligatorios | `trialing`/`active` → `expired` |
| `manual` (Sin vencimiento) | sin fin | nunca vence |

Fuente de verdad: `organizations.service_type`, `service_starts_at`, `service_ends_at`
(migración `20261029120000_service_lifecycle.sql`). `trial_ends_at` queda como campo
legacy: espejo informativo para trials; ninguna lógica de vencimiento lo lee.

## Fechas (decisión)

- Se guardan como `date` (fecha comercial, sin hora) en **America/Argentina/Buenos_Aires**.
- `service_ends_at` es el **último día de servicio, inclusive**. Trial 01/11 → 07/11 = 7 días,
  operativo durante todo el 07/11 (hora Argentina).
- El vencimiento efectivo es a las **00:00 ART del día siguiente** (08/11 03:00 UTC).
- Regla única: `vencido ⇔ fecha comercial de hoy > service_ends_at`
  (`commercialToday()` / `isServicePeriodOver()` en `haven-workers/scanner/src/service-lifecycle.js`).
- Los instantes (logs, `sent_at`, `trial_ends_at` legacy) se guardan en UTC.

## Estados

`trialing`, `active` → con acceso y monitoreo. `trial_ended`, `expired`, `cancelled`, `past_due`
→ sin acceso ni monitoreo, **datos conservados**. Toda la elegibilidad es una lista positiva
(`active`, `trialing`): RLS (`auth_org_ids*`), Worker (`verifyActiveTenant`), scheduler
(`seed_domain_check_state` / `claim_due_checks`), credenciales (`credential_domain_eligibility`),
recordatorios, reportes mensuales y phishing search. Un estado nuevo queda excluido por defecto.
En el Worker: `MONITORING_ORG_STATUSES` / `isOrganizationMonitoringEligible()`.

## Procesamiento automático (sin crons nuevos)

- `*/5 * * * *`: `expireDueServices()` corre **antes** del scheduler del mismo tick. PATCH
  condicional (mismo status / tipo / fecha leídos: no pisa una extensión del Admin), pausa los
  dominios (como el cierre manual de trial; `monitoring_active` se conserva) y registra
  `admin_actions.service_expired` (actor `system:service-lifecycle`). No manda mails.
- `0 9 * * *` (06:00 ART): `processServiceLifecycle()` — vencimientos pendientes, avisos previos y
  entrega de avisos.

Nada se borra: ni findings (no se cierran por vencer), ni dominios, credenciales, informes o usuarios.

## Avisos

| Tipo | Cuándo | Asunto |
|---|---|---|
| `trial_ending_3d` | fin − 3 días | Tu período de evaluación de HAVEN finaliza pronto |
| `trial_ending_1d` | fin − 1 día | Tu período de evaluación de HAVEN finaliza mañana |
| `trial_ended` | al vencer | informe de cierre existente (`trial_closure_reports`, cliente + copia FENIKSO) |
| `contract_ending_30d/15d/7d` | fin − 30/15/7 días | Tu servicio HAVEN vence el DD/MM/AAAA |
| `contract_expired` | al vencer | Tu servicio HAVEN se encuentra vencido |

- Destinatarios: email de la org + owners (`resolveRecipients`, igual que el cierre de trial).
- Idempotencia persistente: `service_lifecycle_notifications`, unique
  `(org_id, notification_type, period_ends_at, audience)`. La fila se persiste **antes** de enviar;
  el envío se reclama `pending|failed → sending`; `Idempotency-Key` de Resend por fila + intento.
  Máximo 3 intentos. Renovar (nuevo `service_ends_at`) habilita avisos nuevos.
- Si el cron no corrió varios días sale solo el aviso más próximo. Un aviso cuya ventana cae antes
  del inicio (trial de 2 días) no se manda. Si la vigencia cambió antes del envío, queda `skipped`.
- `audience` prevé `internal` y `partner` (V1 solo `customer`).

## Admin

`PUT /admin/organizations/:id/service` (`verifyAdmin` + aal2), body
`{ service_type, service_starts_at, service_ends_at, reactivate? }`:

- Org en servicio: guarda la vigencia; status según tipo (trial → `trialing`, contract/manual → `active`).
  El fin no puede ser pasado.
- Org `trial_ended`/`expired`: sin `reactivate` solo corrige fechas; con `reactivate` (fin ≥ hoy)
  vuelve a servicio y restaura el monitoreo de los dominios verificados (mismo tenant).
- `cancelled`/`past_due`: 409 (otros flujos).
- Auditoría en `admin_actions` (`update_service`, `{ field, from, to }` por campo).
- "Activar" desde Facturación rechaza una org con la vigencia terminada (`service_period_ended`).

UI: botón **Acceso y vigencia** en cada tarjeta; **+ Crear cliente** con Trial (7/15/30 días o fecha
custom; default 30) / Contrato / Sin vencimiento.

## Tenant

Sin cambios de diseño: `trial_ended`/`expired` ven "Acceso finalizado" con el texto del estado y
el CTA "Contactar a FENIKSO". El tenant no puede escribir `service_*` (trigger
`service_lifecycle_protect_fields`; `status` ya lo protege P0).

## Próximas fases (no implementado)

- Lectura del histórico en modo solo lectura para tenants vencidos (requiere separar helpers RLS de
  lectura/escritura en todas las policies).
- Grace period: agregar `grace_ends_at` y usarlo en `isServicePeriodOver()`.
- Partner Hub: `partner_id` en la organización (o tabla de entitlements) sin cambiar la vigencia;
  avisos `audience = 'partner'`.
- Tenant Capacity Management (`domain_limit`).
