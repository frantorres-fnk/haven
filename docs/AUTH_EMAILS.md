# Emails de autenticación (HAVEN)

Ningún usuario de HAVEN (tenant, Partner o cliente de un Partner) debe ver "Supabase Auth"
como remitente ni recibir mails genéricos en inglés.

## Quién manda cada email

| Email | Lo envía | Template | Co-branding Partner |
|---|---|---|---|
| Bienvenida "Tu acceso a HAVEN está listo" | Worker (Resend) | `provisioning.js` `buildWelcomeEmail` | sí (si la org es de un Partner activo) |
| "Definí tu contraseña de HAVEN" (owner creado por un Partner) | Worker (Resend) | `provisioning.js` `buildPasswordSetupEmail` | sí |
| Invitación al Partner Hub | Worker (Resend) | `partner.js` | — |
| "¿Olvidaste tu contraseña?" (`/login`, `/partner/login`) | Supabase Auth | `supabase/templates/recovery.html` | no (genérico HAVEN) |
| Confirmación de email al registrarse (onboarding, invitaciones) | Supabase Auth | `supabase/templates/confirmation.html` | no |
| Cambio de email | Supabase Auth | `supabase/templates/email_change.html` | no |
| Magic link (no se usa hoy) | Supabase Auth | `supabase/templates/magic_link.html` | no |

Asuntos: `supabase/templates/subjects.json`.

**Por qué los de Supabase Auth no llevan co-branding:** los templates son uno por proyecto y
solo pueden leer datos del usuario (`.Data` = `user_metadata`, que el propio usuario puede
editar). Personalizarlos por Partner con eso permitiría suplantar la marca, así que no se
hace. Donde el co-branding importa (alta por un Partner), el mail lo manda el Worker con los
datos de la base.

## Links de recuperación

`recovery.html` no usa `{{ .ConfirmationURL }}` (link a `*.supabase.co/auth/v1/verify`, que se
consume con un GET y lo puede quemar un escáner de correo). Usa
`https://haven.fenikso.io/reset-password?token_hash={{ .TokenHash }}&type=recovery`, igual que el
mail del Worker. `/reset-password` canjea el token con `verifyOtp` cuando la persona envía su
contraseña. Los links viejos (`#access_token…&type=recovery`) siguen funcionando.

## Configuración

| Qué | Dónde | Cómo |
|---|---|---|
| Templates + asuntos | Supabase Auth | `ops/auth-email/apply.sh` (Management API) o pegarlos a mano en Dashboard → Authentication → Emails |
| SMTP propio (Resend), remitente `noreply@fenikso.io`, nombre `HAVEN by Fenikso` | Supabase Dashboard | **manual** (contiene la API key) |
| Site URL / Redirect URLs (`https://haven.fenikso.io/reset-password`) | Supabase Dashboard | manual; `check.sh` lo verifica |
| Vencimiento del link (Email OTP Expiration) | Supabase Dashboard | manual; recomendado 86400 s |
| Mails del Worker, `/reset-password` | código | deploy normal |

Verificación: `ops/auth-email/check.sh` (solo lectura).
