# Plan: Task Lifecycle Upgrade

## Resumen

Tres features que mejoran el ciclo de vida de las tareas:
1. **Completar tarea enriquecido** — tiempo real, URL entregable, costo de externos
2. **Flujo de estados obligatorio** — `not_started → in_progress → completed`
3. **Reporte de avance diario** — porcentaje + horas acumuladas con notificación configurable

---

## Dependencias entre fases

```
Fase 1 (DB + completar) ─┐
Fase 2 (in_progress)    ─┼─ Fase 3 (reporte diario, depende de progress_* de Fase 1 + in_progress de Fase 2)
```

Fase 3 depende de que existan `progress_minutes` / `progress_percent` (Fase 1) y el estado `in_progress` sea accesible desde la UI (Fase 2).

---

## Fase 1 — Completar tarea enriquecido

> DB + API + `TaskCompleteDialog` actualizado

### 1.1 Migración DB (`007_task_completion_fields.sql`)
- [x] ~~`completion_minutes`~~ — removido, `progress_minutes` es la fuente única de verdad para tiempo
- [x] Agregar `delivery_url TEXT` a `project_tasks`
- [x] Agregar `completion_cost NUMERIC(10,2)` a `project_tasks`
- [x] Agregar `progress_percent SMALLINT DEFAULT 0` a `project_tasks` (necesario en Fase 3)
- [x] Agregar `progress_minutes INT DEFAULT 0` a `project_tasks` (necesario en Fase 3)

> Todos en una sola migración para no fragmentar el schema.

### 1.2 Tipos (`app/lib/definitions.ts`)
- [x] Agregar `completion_minutes`, `delivery_url`, `completion_cost`, `progress_percent`, `progress_minutes` al tipo `ProjectTask` / `MyTaskRow` / `MyTaskRowPaginated`

### 1.3 Query (`app/lib/queries/projectTasks.ts`)
- [x] Actualizar `completeTask()` para persistir `completion_minutes`, `delivery_url`, `completion_cost`
- [x] Actualizar las queries SELECT que usan `project_tasks` para incluir los 5 nuevos campos
- [x] Agregar función `updateTaskProgress(taskId, { progress_percent, progress_minutes })` (usada en Fase 3)

### 1.4 API — completar tarea (`app/api/projects/[id]/tasks/[tid]/complete/route.ts`)
- [x] Extender el schema Zod para aceptar `completion_minutes` (requerido), `delivery_url` (opcional, string URL), `completion_cost` (opcional, number)
- [x] Pasar los nuevos campos a `completeTask()`

### 1.5 UI — `TaskCompleteDialog` (`app/components/tasks/TaskCompleteDialog.tsx`)
- [x] Agregar selector **horas + minutos** (inputs numéricos separados que se convierten a minutos internamente)
  - Mostrar el acumulado actual de `progress_minutes` si existe (ej: "Llevas X h Y min registrados")
  - Permitir sumar tiempo adicional con botón **"+ Agregar"** que va acumulando antes de guardar
  - El total final se guarda en `completion_minutes`
- [x] Agregar campo **URL entregable** (input text, placeholder "https://...", opcional)
- [x] Agregar campo **Costo** (input number en pesos):
  - Visible solo si `assigned_user.is_internal === false`
  - Si la tarea tiene cotización aceptada (`requires_quote = 1` y existe quote aceptada) → mostrar el valor de la cotización como referencia (read-only) y NO permitir editar
  - Si no tiene cotización aceptada → campo editable por el usuario (asignado externo) O por admin/comercial que complete en nombre del externo

---

## Fase 2 — Flujo de estados obligatorio

> `not_started → in_progress → completed` (sin saltarse `in_progress`)

### 2.1 API — nuevo endpoint "Tomar tarea" (`app/api/projects/[id]/tasks/[tid]/start/route.ts`)
- [x] Crear `POST /api/projects/[id]/tasks/[tid]/start`
- [x] Validación de permisos: solo el `assigned_user_id` de la tarea, o admin/comercial/directivo que sea creador del proyecto (`projects.creator_user_id`)
- [x] Validación de estado: solo desde `not_started` (rechazar si ya está en otro estado)
- [x] Actualizar `status = 'in_progress'` en `project_tasks`
- [x] Registrar transición en `task_transitions` con `from_status: 'not_started'`, `to_status: 'in_progress'`
- [x] Retornar la tarea actualizada

### 2.2 Query (`app/lib/queries/projectTasks.ts`)
- [x] Agregar función `startTask(taskId, movedByUserId)`:
  - Valida que la tarea esté en `not_started`
  - Hace UPDATE de `status` y `assigned_at` si aún no tiene fecha
  - Inserta en `task_transitions`

### 2.3 UI — `/my-tasks` (`app/components/tasks/MyTasksClient.tsx`)
- [x] Tareas `not_started`: reemplazar botón "Completar" por botón **"Tomar tarea"** (PlayCircle, variant="secondary")
- [x] Tareas `in_progress`: mantener botón "Completar" (como hoy)
- [x] Tareas `waiting`: sin botón de acción (solo info de que está en espera)

### 2.4 UI — `ProjectTasksTab` (`app/components/projects/ProjectTasksTab.tsx`)
- [x] Mostrar botón **"Tomar tarea"** también en la vista del proyecto (para admin/comercial/directivo creador)
- [x] Mantener el botón "Completar" solo para tareas `in_progress`

### 2.5 Lógica de `completeTask()` (`app/lib/queries/projectTasks.ts`)
- [x] Actualizar la validación de `completeTask()` para aceptar **solo** `in_progress`
  - `if (task.status !== 'in_progress') throw new Error('Solo se pueden completar tareas en progreso')`

---

## Fase 3 — Reporte de avance diario

> Porcentaje + horas acumuladas + notificación configurable por admin

### 3.1 Configuración — hora de notificación (`app_settings`)
- [ ] Agregar key `daily_report_time` (valor: `"HH:MM"` en formato 24h, default `"18:00"`) a `app_settings`
- [ ] Actualizar `AppSettings` interface en `app/lib/queries/settings.ts`
- [ ] Actualizar schema Zod del PATCH en `app/api/settings/route.ts`
- [ ] Agregar sección **"Reportes"** en `SettingsClient.tsx`:
  - Input de tipo `time` para hora de notificación
  - Botón guardar
  - Solo visible para admin (validar rol en el componente)

### 3.2 API — endpoint de progreso (`app/api/projects/[id]/tasks/[tid]/progress/route.ts`)
- [ ] Crear `POST /api/projects/[id]/tasks/[tid]/progress`
- [ ] Schema Zod: `{ progress_percent: number (0-100), additional_minutes: number (≥0) }`
- [ ] Lógica:
  - `progress_percent` reemplaza el valor actual
  - `progress_minutes` = `current_progress_minutes + additional_minutes` (acumulativo)
- [ ] Solo el `assigned_user_id` puede reportar progreso en su propia tarea
- [ ] Solo tareas en estado `in_progress`

### 3.3 Query (`app/lib/queries/projectTasks.ts`)
- [ ] La función `updateTaskProgress(taskId, { progress_percent, progress_minutes })` ya definida en Fase 1 — conectarla aquí

### 3.4 Modal de reporte (`app/components/tasks/TaskProgressReportModal.tsx`) — **nuevo componente**
- [ ] Recibe lista de tareas `in_progress` del usuario
- [ ] Por cada tarea muestra:
  - Nombre del proyecto + nombre de la tarea
  - Slider o input **porcentaje de avance** (0–100)
  - Línea de tiempo acumulado: `"Llevas X h Y min"` + input **horas + minutos adicionales** + botón **"+ Agregar"**
    - Al hacer clic en "+ Agregar": suma al acumulado local (en estado React), no guarda todavía
    - El acumulado local se actualiza visualmente antes de guardar
  - Botón **"Guardar avance"** por tarea
- [ ] Al guardar → `POST .../progress` → marca esa tarea como "ya reportada esta sesión" en estado local del componente
- [ ] Tarea ya reportada → fondo/borde diferente (ej: verde suave) para distinguirla visualmente

### 3.5 Notificación y bandera en URL (`app/components/tasks/MyTasksClient.tsx` + layout)
- [ ] Lógica de detección de hora (client-side):
  - Al montar la app (en layout o en `MyTasksClient`), comparar hora actual con `daily_report_time` de `app_settings`
  - Si hora actual >= hora configurada Y el usuario tiene tareas `in_progress` Y no hay flag `?report=dismissed` en la sesión → mostrar notificación
  - Usar `sessionStorage` para recordar que ya se cerró la notificación en esta sesión (no volver a mostrarla hasta el próximo día)
- [ ] Notificación: icono/campana en el header o badge en sidebar con texto "Reporta tu avance de hoy"
  - Al hacer clic → abre `TaskProgressReportModal` Y agrega `?report=1` a la URL
- [ ] En `/my-tasks` con `?report=1`:
  - Resaltar visualmente (borde o fondo de color) las tareas `in_progress` que **no han sido reportadas aún en esta sesión** (tracking en estado React, no en DB)
  - Al abrir el `TaskProgressReportModal` de una tarea específica → quitarle el resaltado (marcada como "vista")
- [ ] Al completar una tarea → `progress_percent` se establece en `100` automáticamente en `completeTask()`

### 3.6 `TaskCompleteDialog` — integración con progreso acumulado (complemento de Fase 1.5)
- [ ] Al abrir el dialog de completar, mostrar `progress_minutes` acumulado previamente
- [ ] El selector de tiempo final (`completion_minutes`) inicia con ese acumulado precargado
- [ ] Permitir sumar tiempo adicional con botón **"+ Agregar"** (igual que en `TaskProgressReportModal`)
- [ ] El total final (acumulado + lo que agregue ahora) se guarda en `completion_minutes`

---

## Archivos que se tocan por fase

### Fase 1
| Archivo | Cambio |
|---|---|
| `db/migrations/007_task_completion_fields.sql` | NUEVO — 5 columnas nuevas en `project_tasks` |
| `app/lib/definitions.ts` | Extender tipos de tarea |
| `app/lib/queries/projectTasks.ts` | `completeTask()`, SELECTs, nueva `updateTaskProgress()` |
| `app/api/projects/[id]/tasks/[tid]/complete/route.ts` | Zod schema + nuevos campos |
| `app/components/tasks/TaskCompleteDialog.tsx` | UI: tiempo, URL, costo |

### Fase 2
| Archivo | Cambio |
|---|---|
| `app/api/projects/[id]/tasks/[tid]/start/route.ts` | NUEVO — endpoint "Tomar tarea" |
| `app/lib/queries/projectTasks.ts` | Nueva `startTask()`, actualizar validación en `completeTask()` |
| `app/components/tasks/MyTasksClient.tsx` | Botón "Tomar tarea" en `not_started` |
| `app/components/projects/ProjectTasksTab.tsx` | Botón "Tomar tarea" para admin/comercial |

### Fase 3
| Archivo | Cambio |
|---|---|
| `app/lib/queries/settings.ts` | Agregar `daily_report_time` |
| `app/api/settings/route.ts` | Zod schema extendido |
| `app/components/settings/SettingsClient.tsx` | Sección "Reportes" con input de hora |
| `app/api/projects/[id]/tasks/[tid]/progress/route.ts` | NUEVO — endpoint de progreso |
| `app/components/tasks/TaskProgressReportModal.tsx` | NUEVO — modal de reporte |
| `app/components/tasks/MyTasksClient.tsx` | Notificación, flag URL `?report=1`, resaltado |

---

## Criterios de aceptación globales

- [ ] Un usuario **no puede completar** una tarea que esté en `not_started` (debe pasar primero por `in_progress`)
- [ ] Un usuario **externo con cotización aceptada** ve el costo de la cotización como referencia al completar, no puede modificarlo
- [ ] Un usuario **externo sin cotización** puede ingresar el costo al completar; también puede hacerlo el admin/comercial
- [ ] La URL de entregable y el tiempo son opcionales al completar para tareas `execution`; también opcionales para `validation`
- [ ] El `progress_minutes` es siempre acumulativo (nunca se reemplaza, solo se suma)
- [ ] Al completar una tarea, `progress_percent` queda en `100` automáticamente
- [ ] La notificación de reporte no vuelve a aparecer en la misma sesión del navegador una vez descartada
- [ ] Solo admin puede configurar la hora de notificación
