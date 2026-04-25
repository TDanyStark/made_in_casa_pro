# Plan por fases: Sistema de notificaciones y emails

## Objetivo

Implementar un sistema de notificaciones para informar a las personas relacionadas a los proyectos sobre movimientos relevantes, usando emails HTML bonitos, plantillas mantenidas por desarrollador, Gmail obligatorio por usuario para acciones operativas y un correo del sistema configurado por `.env` para notificaciones automaticas o tecnicas.

## Decisiones principales

- El uso normal de la app requiere que el usuario tenga Gmail conectado.
- Si el usuario no tiene Gmail conectado al iniciar sesion, se debe redirigir a una pantalla dedicada para conectar Gmail.
- Si Gmail se desconecta, expira o el token es revocado, debe tratarse como error bloqueante hasta reconectar.
- Los emails de acciones humanas deben salir desde el Gmail del usuario que realiza la accion.
- Los emails automaticos o tecnicos deben salir desde el correo del sistema configurado en `.env`.
- Las plantillas HTML seran archivos de codigo, no editables desde UI.
- Cada version o ajuste de proyecto debe tener su propio hilo de email.

## Variables de entorno

Agregar configuracion del correo del sistema:

```env
NOTIFICATION_FROM_EMAIL=notificaciones@tudominio.com
NOTIFICATION_FROM_NAME=Made in Casa
NOTIFICATION_REPLY_TO_EMAIL=soporte@tudominio.com

EMAIL_PROVIDER=smtp
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=
```

Si se decide usar un proveedor API:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=
NOTIFICATION_FROM_EMAIL=notificaciones@tudominio.com
NOTIFICATION_FROM_NAME=Made in Casa
NOTIFICATION_REPLY_TO_EMAIL=soporte@tudominio.com
```

## Fase 1: Modelo de datos e infraestructura base

Estado: implementada.

### Objetivo

Crear la base persistente para conexiones Gmail, eventos de notificacion, entregas de email e hilos por version de proyecto.

### Cambios propuestos

Crear migracion con tablas:

- `user_email_connections`
- `notification_events`
- `notification_deliveries`
- `project_email_threads`

### Tabla: `user_email_connections`

Guarda la conexion Gmail por usuario.

Campos sugeridos:

- `id`
- `user_id`
- `provider`
- `email`
- `access_token`
- `refresh_token`
- `expires_at`
- `scopes`
- `status`
- `last_error`
- `created_at`
- `updated_at`

Estados sugeridos:

- `connected`
- `invalid`
- `disconnected`

### Tabla: `notification_events`

Registra eventos relevantes del sistema.

Campos sugeridos:

- `id`
- `event_type`
- `project_id`
- `task_id`
- `adjustment_id`
- `actor_user_id`
- `metadata`
- `created_at`

### Tabla: `notification_deliveries`

Registra intentos de envio.

Campos sugeridos:

- `id`
- `event_id`
- `recipient_user_id`
- `recipient_email`
- `sender_user_id`
- `provider`
- `status`
- `error`
- `gmail_thread_id`
- `message_id`
- `sent_at`
- `created_at`

Estados sugeridos:

- `pending`
- `sent`
- `failed`
- `skipped`

### Tabla: `project_email_threads`

Mantiene hilos de correo por proyecto y version/ajuste.

Campos sugeridos:

- `id`
- `project_id`
- `adjustment_id`
- `thread_key`
- `provider`
- `gmail_thread_id`
- `root_message_id`
- `created_by_user_id`
- `created_at`
- `updated_at`

### Validaciones

- [x] Tests unitarios para queries nuevas (4 archivos de test).
- [x] Verificar migracion localmente (migración 009_notification_system.sql creada).
- [x] No integrar todavia envios reales.

---

## Fase 1: COMPLETADA ✅

**Fecha:** 2026-04-24

**Archivos creados:**
- `db/migrations/009_notification_system.sql` - Migración con 4 tablas
- `app/lib/queries/userEmailConnections.ts` - Helpers para conexiones Gmail
- `app/lib/queries/notificationEvents.ts` - Helpers para eventos
- `app/lib/queries/notificationDeliveries.ts` - Helpers para deliveries
- `app/lib/queries/projectEmailThreads.ts` - Helpers para hilos
- `app/lib/definitions.ts` - Types exportados
- `__tests__/queries/userEmailConnections.test.ts`
- `__tests__/queries/notificationEvents.test.ts`
- `__tests__/queries/notificationDeliveries.test.ts`
- `__tests__/queries/projectEmailThreads.test.ts`

**Decisiones:**
- FK a `users`, `projects`, `project_tasks`, `project_adjustments` con `ON DELETE CASCADE/SET NULL`
- CHECK constraints alineados con PostgreSQL para `status`, `provider`
- Indexes en campos de filtro: `user_id`, `project_id`, `task_id`, `event_id`, `status`, `thread_key`
- `metadata` en `notification_events` usa JSONB (nativo PostgreSQL)
- `thread_key` permite uniqueness por `(project_id, adjustment_id, thread_key)` para threads custom
- Upsert en conexiones para re-conexión sin duplicados

## Fase 2: Conexion Gmail por usuario

Estado: implementada.

### Objetivo

Permitir que cada usuario conecte su Gmail y guardar tokens necesarios para enviar correos desde su cuenta.

### Cambios propuestos

Crear endpoints:

- `GET /api/user-email/google`
- `GET /api/user-email/google/callback`
- `POST /api/user-email/google/disconnect`
- `GET /api/user-email/status`

Scopes minimos:

```txt
https://www.googleapis.com/auth/gmail.send
```

Si se necesita leer metadata del hilo mas adelante:

```txt
https://www.googleapis.com/auth/gmail.modify
```

Preferencia inicial:

- Usar solo `gmail.send` si alcanza para enviar y crear hilos.
- Evitar scopes de lectura salvo que sean necesarios.

### Comportamiento

- Al conectar Gmail, guardar tokens asociados al usuario autenticado.
- Al desconectar, marcar conexion como `disconnected`.
- Si Google devuelve `invalid_grant`, marcar conexion como `invalid`.

### Validaciones

- Test de callback OAuth.
- Test de desconexion.
- Test de deteccion de token invalido.

## Fase 3: Bloqueo de app si Gmail no esta conectado

Estado: implementada.

### Objetivo

Forzar que usuarios operativos conecten Gmail antes de usar la app.

### Cambios propuestos

Crear una pantalla dedicada:

```txt
/connect-email
```

La pantalla debe incluir:

- Explicacion breve de por que se requiere Gmail.
- Boton "Conectar Gmail".
- Estado actual de conexion.
- Mensajes claros para token invalido o desconectado.
- Boton para cerrar sesion.

### Reglas de acceso

Permitir sin Gmail:

- `/connect-email`
- rutas de OAuth/callback
- logout
- login
- assets publicos
- endpoints necesarios para consultar estado y conectar Gmail

Bloquear sin Gmail:

- dashboard
- proyectos
- tareas
- cotizaciones
- acciones operativas

### Excepciones posibles

Definir si aplican:

- Admin tecnico puede entrar sin Gmail.
- Ambiente local puede permitir bypass con variable `.env`.

Variable opcional:

```env
REQUIRE_GMAIL_CONNECTION=true
```

### Validaciones

- Test de middleware/guard.
- Test de usuario sin Gmail redirigido a `/connect-email`.
- Test de usuario con Gmail conectado accede normal.
- Test de token invalido bloquea app.

## Fase 4: Servicio de email

Estado: implementada.

### Objetivo

Crear una interfaz unica para enviar emails desde Gmail del usuario o desde el correo del sistema.

### Archivos sugeridos

```txt
app/lib/services/email/
  emailService.ts
  gmailEmailProvider.ts
  systemEmailProvider.ts
  emailTypes.ts
```

### API interna sugerida

```ts
sendEmail({
  senderUserId,
  recipient,
  subject,
  html,
  text,
  projectId,
  taskId,
  adjustmentId,
  threadKey,
  forceSystemSender,
})
```

### Reglas

- Si `forceSystemSender` es `true`, usar correo del sistema.
- Si el evento es accion humana, usar Gmail del actor.
- Si Gmail esta invalido en una accion humana, bloquear accion y pedir reconexion.
- Registrar cada intento en `notification_deliveries`.

### Validaciones

- Test de envio usando Gmail provider mockeado.
- Test de envio usando system provider mockeado.
- Test de error `invalid_grant`.
- Test de registro de delivery fallido.

## Fase 5: Plantillas HTML en codigo

Estado: implementada.

### Objetivo

Centralizar plantillas bonitas, reutilizables y faciles de editar por desarrollador.

### Estructura sugerida

```txt
app/lib/email/templates/
  layout.ts
  components.ts
  taskAssigned.ts
  taskCompleted.ts
  quoteRequested.ts
  quoteReceived.ts
  quoteAccepted.ts
  projectAdjustmentCreated.ts
  projectCompleted.ts
```

### Cada plantilla debe exportar

```ts
{
  subject(context) {},
  html(context) {},
  text(context) {},
}
```

### Requisitos de diseno

- HTML compatible con clientes de correo.
- Usar tablas o estilos inline si hace falta compatibilidad.
- Incluir version plain text.
- Incluir boton principal.
- Incluir datos clave del proyecto/tarea.
- Incluir firma de Made in Casa.
- Evitar depender de CSS externo.

### Validaciones

- Tests de renderizado basico.
- Tests de variables requeridas.
- Snapshot opcional para HTML.

## Fase 6: Motor de notificaciones

Estado: implementada.

### Objetivo

Crear una capa que reciba eventos del dominio y resuelva destinatarios, plantilla, sender e hilo.

### Archivo sugerido

```txt
app/lib/services/notifications.ts
```

### API interna sugerida

```ts
dispatchNotification({
  eventType,
  actorUserId,
  projectId,
  taskId,
  adjustmentId,
  metadata,
})
```

### Responsabilidades

- Crear `notification_events`.
- Resolver destinatarios.
- Resolver sender.
- Resolver plantilla.
- Resolver `threadKey`.
- Enviar email.
- Registrar deliveries.

### Eventos iniciales

- `task.assigned`
- `task.completed`
- `quote.requested`
- `quote.received`
- `quote.accepted`
- `project.adjustment.created`
- `project.completed`

### Validaciones

- Test de resolucion de destinatarios.
- Test de evento sin destinatarios.
- Test de evento con multiples destinatarios.
- Test de que no se envie al actor si no corresponde.

## Fase 7: Hilos por version de proyecto

Estado: implementada.

### Objetivo

Garantizar que cada version/ajuste del proyecto tenga su propio hilo.

### Regla de thread key

Formato sugerido:

```txt
project:{projectId}:version:v{versionNumber}
```

Ejemplos:

```txt
project:15:version:v1
project:15:version:v2
```

### Comportamiento

- Primer email de una version crea hilo.
- Siguientes emails de la misma version reutilizan hilo.
- Guardar `gmail_thread_id` si Gmail lo devuelve.
- Guardar `message_id` raiz para proveedores SMTP.

### Validaciones

- Test de creacion de hilo nuevo.
- Test de reutilizacion de hilo existente.
- Test de versiones distintas generan hilos distintos.

## Fase 8: Integracion con flujos existentes

Estado: implementada.

### Objetivo

Disparar notificaciones en acciones importantes.

### Puntos de integracion

- Crear proyecto.
- Actualizar proyecto.
- Completar proyecto.
- Crear tarea.
- Asignar tarea.
- Cambiar estado de tarea.
- Completar tarea.
- Invitar colaborador a cotizar.
- Recibir cotizacion.
- Aceptar cotizacion.
- Crear ajuste/version de proyecto.

### Regla importante

Las notificaciones deben dispararse despues de que la mutacion principal fue exitosa.

No deben romper datos ya guardados salvo cuando Gmail sea obligatorio para completar una accion humana.

### Validaciones

- Tests de integracion por endpoint principal.
- Test de que falla la accion si requiere Gmail y el actor no lo tiene conectado.
- Test de que eventos automaticos usan correo del sistema.

## Fase 9: UI de estado e historial

Estado: implementada.

### Objetivo

Dar visibilidad minima al usuario sobre su conexion Gmail y los correos enviados.

### Cambios propuestos

Agregar en configuracion:

- Estado de Gmail.
- Boton conectar/reconectar.
- Boton desconectar.
- Ultimo error si existe.

Agregar en proyecto/tarea, si aplica:

- Historial basico de emails enviados.
- Destinatario.
- Estado.
- Fecha.
- Provider usado.

### Validaciones

- [x] Test de render de estado conectado.
- [x] Test de render de estado invalido.
- [x] Test de boton reconectar.

## Fase 9: COMPLETADA ✅

**Fecha:** 2026-04-24

**Archivos creados:**
- `app/lib/queries/notificationDeliveries.ts` — agregada `getDeliveriesByProject()`
- `app/api/notification-deliveries/route.ts` — GET historial reciente (solo admin)
- `app/api/projects/[id]/notification-deliveries/route.ts` — GET historial por proyecto
- `app/components/settings/GmailStatusCard.tsx` — card con estado Gmail + conectar/desconectar/reconectar
- `app/components/notifications/EmailHistoryTable.tsx` — tabla reutilizable de historial de emails
- `app/components/settings/SettingsClient.tsx` — agregada `<GmailStatusCard />`
- `app/components/projects/ProjectDetailClient.tsx` — agregada pestaña "Notificaciones"
- `__tests__/api/notification-deliveries/route.test.ts`
- `__tests__/api/projects/[id]/notification-deliveries/route.test.ts`
- `__tests__/queries/notificationDeliveries.test.ts` — agregados tests de `getDeliveriesByProject()`

**Decisiones:**
- `GmailStatusCard` es un componente standalone que se agrega a la página de Settings.
- `EmailHistoryTable` acepta `projectId` opcional; sin él, llama al endpoint global (admin only).
- La pestaña "Notificaciones" en proyectos solo es visible para roles con permiso de edición.
- Límite máximo de 200 registros por request para evitar payloads excesivos.

## Fase 10: Robustez y monitoreo

Estado: implementada.

### Objetivo

Mejorar confiabilidad antes de considerar el sistema completo.

### Cambios propuestos

- Reintentos para emails fallidos.
- Logging claro de errores.
- Evitar duplicados por evento.
- Marcar tokens invalidos automaticamente.
- Panel simple para revisar deliveries fallidos.

### Validaciones

- [x] Test de idempotencia.
- [x] Test de reintento.
- [x] Test de error permanente.

## Fase 10: COMPLETADA ✅

**Fecha:** 2026-04-24

**Archivos creados:**
- `app/lib/services/notificationLogger.ts` — logging estructurado con prefijo `[notif:scope]`
- `app/api/notification-deliveries/[id]/retry/route.ts` — POST reintento de delivery fallido (solo admin)
- `app/components/notifications/FailedDeliveriesPanel.tsx` — panel admin con tabla de emails fallidos + botón reintentar
- `__tests__/api/notification-deliveries/[id]/retry/route.test.ts`

**Archivos modificados:**
- `app/lib/queries/notificationDeliveries.ts` — agregados `MAX_RETRY_COUNT`, `getDeliveryCountByEventAndRecipient()`
- `app/lib/queries/notificationEvents.ts` — agregado `getNotificationEventById()`
- `app/lib/services/email/emailService.ts` — idempotencia pre-send + logging + re-export `markDeliverySkipped`
- `app/lib/services/notificationEngine.ts` — logging de errores con `notifLog`
- `app/components/settings/SettingsClient.tsx` — `<FailedDeliveriesPanel />` para admins
- `__tests__/queries/notificationDeliveries.test.ts` — tests de idempotencia y reset
- `__tests__/queries/notificationEvents.test.ts` — tests de `getNotificationEventById`

**Decisiones:**
- Idempotencia: `sendEmail` verifica si ya existe un delivery no-skipped para `(event_id, recipient_email)` antes de crear uno nuevo.
- Reintento: el endpoint resetea a `pending` y re-despacha vía `dispatchNotification` (crea nuevo event row para auditoría completa).
- Límite de reintentos: `MAX_RETRY_COUNT = 3`, el endpoint devuelve 422 si se supera.
- Token inválido: ya manejado en `GmailEmailProvider` desde Fase 4 — auto-marca `invalid` en la conexión.
- Logging: todas las líneas usan formato `[notif:scope] LEVEL: mensaje` para grep en producción.

## Orden recomendado de ejecucion

1. Fase 1: Tablas base.
2. Fase 2: Gmail por usuario.
3. Fase 3: Bloqueo de app sin Gmail.
4. Fase 4: Servicio de email.
5. Fase 5: Plantillas HTML.
6. Fase 6: Motor de notificaciones.
7. Fase 7: Hilos por version.
8. Fase 8: Integracion con eventos reales.
9. Fase 9: UI de historial/estado.
10. Fase 10: Robustez.

## Criterios de aceptacion generales

- Un usuario sin Gmail conectado no puede usar la app operativa.
- Un usuario puede conectar, reconectar y desconectar Gmail.
- Si Gmail queda invalido, la app lo bloquea con mensaje claro.
- El correo del sistema sale desde variables `.env`.
- Las acciones humanas envian desde Gmail del actor.
- Las plantillas estan centralizadas en codigo.
- Los emails HTML se ven profesionales.
- Cada version/ajuste de proyecto mantiene su propio hilo.
- Cada envio queda registrado con estado.
- Los errores de email son visibles y diagnosticables.
