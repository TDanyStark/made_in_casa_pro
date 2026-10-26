# Made in Casa Pro

Plataforma interna de gestión de proyectos de agencia: clientes (laboratorios),
sus gerentes, marcas, proyectos y las tareas que los ejecutan, con cotización por
colaborador, notificaciones por correo y auditoría de los cambios sensibles.

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 (App Router, Turbopack en dev) + React 19 |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL (`pg`), acceso vía adaptador propio en `app/lib/db/` |
| Estado de servidor | TanStack React Query 5 |
| UI | Tailwind CSS 4 + shadcn/ui (Radix), lucide-react, sonner, TipTap |
| Formularios / validación | react-hook-form + Zod |
| Sesión | JWT firmado con `jose` en cookie httpOnly |
| Tests | Jest 30 + Testing Library |

El alias `@/*` apunta a `app/*` (ver `tsconfig.json`).

## Estructura

```
app/
  page.tsx              login (única ruta pública)
  (admin)/              UI autenticada: dashboard, projects, tasks, clients,
                        brands, managers, products, users, settings, my-tasks,
                        my-quotes
  api/                  route handlers (NextRequest/NextResponse)
  components/
    ui/                 componentes shadcn reutilizables
    <dominio>/          componentes por dominio (projects, managers, brands…)
  lib/
    db/                 adaptador PostgreSQL (`db.execute`, `db.transaction`)
    queries/            capa de datos por entidad
    services/           apiService, api-auth, api-errors, email, siigo, OAuth
    definitions.ts      tipos y enums compartidos (incluye UserRole)
    errors.ts           DomainError + DOMAIN_ERROR_STATUS
    LinksData.ts        navegación + roles por ruta
    permissions.ts      resolución de permisos (soporta rutas dinámicas)
    role-groups.ts      grupos de roles reutilizables
    session.ts          encrypt/decrypt de la sesión JWT
db/
  migrate.ts            runner de migraciones
  migrations/           NNN_*.sql, aplicadas en orden alfabético
__tests__/              espeja la estructura de app/
middleware.ts
```

## Modelo de dominio

```
clients (laboratorios)
  └── managers          gerente de contacto del cliente
brands                  marca comercial       → client_id, manager_id
projects                proyecto sobre marca  → client_id, brand_id, manager_id
  └── project_brands    marcas asociadas      → brand_id (mismo cliente)
  └── project_tasks     tareas ejecutables    → task_quotes, task_transitions
```

Alrededor: `countries`, `business_units`, `areas`, `skills`, `products` /
`product_categories` / `product_task_templates`, `campaigns`, `users` / `roles`,
`project_managers` (co-gerentes), `project_adjustments` (versiones del alcance).

### La marca y el proyecto son dueños de su `client_id`

`brands.client_id` y `projects.client_id` son **columnas propias** (migración
`012_denormalize_client_id.sql`), no valores derivados de `managers.client_id`.

Antes el cliente se resolvía en tiempo de lectura haciendo join contra el gerente.
Eso significaba que trasladar un gerente de laboratorio **reescribía
retroactivamente el cliente de todo su histórico**: proyectos ya facturados y
reportes cerrados cambiaban de laboratorio solos. Además, reasignar una marca a
un gerente de otro cliente la movía de cliente en silencio, sin validación.

De ahí salen dos reglas que el código sostiene:

1. **Cambiar el gerente de una marca o proyecto nunca cambia su `client_id`.**
   El nuevo gerente debe pertenecer al mismo cliente; si no, se lanza
   `DomainError("MANAGER_CLIENT_MISMATCH")` → 400.
2. **Invariante de proyectos:** `projects.client_id` siempre coincide con el
   `client_id` de su marca. El cliente de un proyecto es el de la marca sobre la
   que se ejecuta, no el del gerente que lo tramita.

## Autenticación y permisos

- **Sesión**: JWT firmado con `SESSION_SECRET` (`app/lib/session.ts`), guardado
  en la cookie `session` con `httpOnly`, 7 días de vigencia. El payload lleva
  `id`, `name`, `email` y `rol_id`.
- **`middleware.ts`**: descifra la cookie en cada request. Redirige al login lo
  no autenticado, devuelve `401 JSON` si la ruta es `/api/*`, y para las páginas
  comprueba el permiso con `checkRoutePermission`. Inyecta el header
  `x-current-path`. La única ruta pública es `/` (`publicRoutes`).
- **`app/lib/LinksData.ts`**: fuente de verdad de las rutas. `links` son las
  visibles en el menú y `linksNotVisible` las alcanzables por navegación
  (incluidas las dinámicas como `/clients/[id]`). Cada entrada declara sus roles.
- **`app/lib/permissions.ts`**: construye `routePermissions` a partir de esos dos
  arreglos y resuelve rutas dinámicas comparando segmentos (`[id]` comodín).
- **`app/lib/role-groups.ts`**: grupos reutilizables sobre el enum `UserRole`
  (`ADMIN=1`, `DIRECTIVO=2`, `COMERCIAL=3`, `COLABORADOR=4`, `FINANCIERO=5`):
  `ADMIN_ONLY_ROLES`, `LEADERSHIP_ROLES`, `OPERATIONS_ROLES`,
  `PROJECT_VIEW_ROLES`, `PROJECT_EDIT_ROLES`, `TASK_OVERRIDE_ROLES`…
- **`app/lib/services/api-auth.ts`**: el middleware no autoriza las APIs; cada
  handler debe llamar primero a `validateHttpMethod(request, [...])` y luego a
  `validateApiRole(request, ROLES)`. `validateApiRole` devuelve 401 sin sesión,
  403 por rol insuficiente y 428 si `REQUIRE_GMAIL_CONNECTION=true` y el usuario
  (no admin) todavía no conectó Gmail.

Los errores de negocio se lanzan como `DomainError` desde `app/lib/queries/**` y
el handler los traduce con `domainErrorResponse` (`app/lib/services/api-errors.ts`)
usando `DOMAIN_ERROR_STATUS`.

## Traslado de gerentes entre clientes

`transferManager` en `app/lib/queries/managers.ts`, expuesto en
`POST /api/managers/[id]/transfer` (`OPERATIONS_ROLES`). La pantalla previa usa
`GET /api/managers/[id]/transfer-preview`, que lista lo que quedaría huérfano y
los sucesores disponibles del cliente actual.

Un gerente es **siempre la misma fila** en `managers`: trasladarlo es un
`UPDATE managers SET client_id` más una fila de historial, nunca una fila
duplicada.

Reglas al trasladar (las marcas **nunca** cambian de cliente; solo cambia su gerente):

| Caso | Resultado |
|------|-----------|
| Marca del gerente **con sucesor** | Se queda en su cliente y cambia de gerente (+ `brand_manager_history`); **todos** sus proyectos (cualquier estado y gerente actual) pasan al sucesor (+ `project_manager_history`) |
| Marca del gerente **sin sucesor** | El traslado se **rechaza** (`BRANDS_WITHOUT_SUCCESSOR`, 400) nombrando las marcas; no se escribe nada |
| Otro proyecto del gerente (marca no reasignada en el traslado) | Pasa al gerente actual de **su marca principal** (+ `project_manager_history`), en cualquier estado. No hay elección por proyecto |

`brands.client_id` y `projects.client_id` nunca se modifican en un traslado. Si
la marca principal de un proyecto quedara sin gerente o con el gerente que se va,
la transacción falla cerrada (`BRANDS_WITHOUT_SUCCESSOR`) y hace `rollback`.

Orden obligatorio dentro de la única transacción:

1. Reasignar las marcas a sus sucesores (+ `brand_manager_history`) y, por cada
   una, pasar todos sus proyectos al sucesor (`cascadeBrandManagerToProjects`,
   + `project_manager_history`).
2. Pasar los proyectos restantes del gerente al gerente de su marca principal
   (+ `project_manager_history`). Los ya movidos en el paso 1 no se repiten.
3. `UPDATE managers SET client_id` (y email / teléfono si cambian).
4. Insertar en `manager_client_history`.

Si se invirtiera el orden, los sucesores —validados contra el cliente viejo—
quedarían apuntando a un laboratorio que ya no es el suyo. Cualquier fallo hace
`rollback` completo.

Validaciones previas (fuera de la transacción, solo lecturas): `MANAGER_NOT_FOUND`,
`SAME_CLIENT`, `CLIENT_NOT_FOUND`, `EMAIL_IN_USE` (`managers.email` es UNIQUE
global), `MANAGER_CLIENT_MISMATCH` cuando la marca o el sucesor no son
del cliente que se está dejando, o cuando el sucesor es el propio gerente, y
`BRANDS_WITHOUT_SUCCESSOR` cuando alguna marca del gerente no tiene sucesor
(mensaje: "Asigna un nuevo gerente a todas las marcas antes del traslado: Marca A, Marca B").

El endpoint ya no acepta `project_reassignments` (400 "Datos inválidos" si se
envía). El resultado devuelve `reassigned_brands` (marcas heredadas por sus
sucesores) y `followed_projects` (**todos** los proyectos que cambiaron de
gerente en el traslado: los de las marcas reasignadas más los demás del gerente). El diálogo de traslado exige un nuevo gerente por marca antes de enviar y
lista los proyectos del gerente solo como información.

### Marcas asociadas de un proyecto

`projects.brand_id` es la **marca principal**: define cliente, gerente, carpeta de
Drive y la línea "Marca" de los correos, igual que antes. Un proyecto puede además
vincularse a **marcas asociadas** en `project_brands` (migración
`023_project_brands.sql`).

- `POST /api/projects` y `PATCH /api/projects/[id]` aceptan
  `additional_brand_ids: number[]`; en PATCH reemplaza el conjunto completo
  (`[]` quita todas).
- Reglas (`app/lib/queries/projectBrands.ts`): marcas existentes
  (`BRAND_NOT_FOUND` → 404), del mismo `projects.client_id`
  (`BRAND_CLIENT_MISMATCH` → 400) y distintas de la principal
  (`ADDITIONAL_BRAND_IS_PRINCIPAL` → 400). Si falla, no se escribe nada.
- Las respuestas de proyecto incluyen `additional_brands: {id, name}[]`; filtrar
  proyectos o "Mis tareas" por `brand_id` incluye los proyectos asociados a esa marca.
- El traslado de gerentes no modifica `project_brands`.
- UI: paso 1 del wizard ("Marcas asociadas") y tarjeta "Marcas" en la pestaña de
  información del proyecto.

### Reasignación de gerente en un proyecto

El gerente de un proyecto es **siempre el gerente actual de su marca principal**
(`projects.brand_id`). Solo cambia reasignando la marca:

- `updateBrand` (`PATCH /api/brands/[id]`, botón "Asignar Nuevo Gerente" de la
  marca), en **una sola transacción**: actualiza la marca, escribe
  `brand_manager_history` (con `changed_at`; sirve para saber quién era el
  gerente de la marca cuando se creó cada proyecto) y pasa **todos** los
  proyectos de la marca, en cualquier estado, al nuevo gerente con una fila en
  `project_manager_history` cada uno (`cascadeBrandManagerToProjects`). Si algo
  falla, `rollback` completo.
- Tras confirmar, la ruta re-sincroniza el acceso a Drive de esos proyectos
  (best effort: un fallo se devuelve como `driveWarning`, nunca bloquea). La
  respuesta incluye `reassigned_projects` (cuántos proyectos cambiaron).
- `PATCH /api/projects/[id]` con `manager_id` → 400
  `{ error: "El gerente del proyecto se cambia reasignando su marca" }`, sin
  escribir nada. La tarjeta "Gerente principal" del proyecto es de solo lectura
  y remite a la marca.
- `POST /api/projects` exige que `manager_id` sea el gerente de la marca
  principal; si no, `MANAGER_NOT_BRAND_MANAGER` → 400 ("El gerente del proyecto
  debe ser el gerente de su marca principal") sin escribir nada.

El `client_id` del proyecto nunca se toca. El historial se consulta en
`GET /api/projects/[id]/manager-history`.

## Carpetas de Drive de proyectos

Cada proyecto puede vincularse a una carpeta de Google Drive bajo la jerarquía
`Made In Casa / {cliente} / {marca} / {proyecto}`. El id se persiste en
`projects.drive_folder_id` y la URL completa en `drive_folder_url`.

### Carpeta de Drive al crear un proyecto (wizard)

En el paso de confirmación del wizard de creación (`WizardStep6Confirm`) hay un
campo **opcional**: "¿Ya existe una carpeta de Drive para este proyecto?". No
hay ninguna búsqueda automática por nombre (el equipo puede haber creado la
carpeta en otro lugar de la jerarquía o con un nombre distinto, así que una
detección automática por nombre no puede garantizar encontrarla). Según lo que
el usuario ingrese:

| Campo | Comportamiento |
|-------|-----------------|
| Vacío | Flujo original sin cambios: se llama a `POST /api/drive/create-folder` y se crea (o reutiliza si ya existe con ese nombre exacto) la carpeta al confirmar |
| URL válida de `drive.google.com` | Se omite la creación por completo; se persiste directamente `drive_folder_url` y el `drive_folder_id` derivado con `parseDriveFolderId` |
| URL inválida | Error de validación en línea; bloquea "Crear proyecto" hasta corregirla o dejar el campo vacío |

La creación del proyecto nunca se bloquea por causa de Drive.

### Reparar o recrear la carpeta de un proyecto existente

En la pestaña de información del proyecto (`ProjectInfoTab`), la sección
"Carpeta en Drive" permite:

- **Recrear carpeta**: `POST /api/projects/[id]/drive/recreate` busca o crea
  (reutilizando si ya existe) la cadena cliente → marca → proyecto y actualiza
  `drive_folder_id`/`drive_folder_url`. Pensada para proyectos con carpeta
  huérfana u obsoleta (p. ej. tras la migración de service-account a OAuth).
  Requiere confirmación en un `AlertDialog`.
- **URL personalizada**: editar manualmente `drive_folder_url` vía
  `PATCH /api/projects/[id]`. Debe ser un enlace de `drive.google.com`; el id
  de la carpeta se deriva en el servidor con `parseDriveFolderId`
  (`app/lib/utils/drive-url.ts`). Dejar el campo vacío y guardar desvincula la
  carpeta (limpia `drive_folder_id` y `drive_folder_url`, sin tocar Drive).

Ambas acciones requieren rol `PROJECT_EDIT_ROLES`.

### Control de acceso de Drive

Google Drive es la fuente de verdad de los permisos; no se replica la ACL en la
base de datos. La tabla `project_drive_access_failures` conserva únicamente el
código sanitizado y la fecha del último intento fallido por proyecto/correo,
porque esa causa no puede reconstruirse desde `permissions.list`. En Información
del proyecto se consultan los permisos reales con
`GET /api/projects/[id]/drive/permissions`, incluyendo accesos de usuario, grupo,
dominio o enlace y la capacidad `canShare`. Los usuarios con acceso al proyecto
pueden ver la lista. `PROJECT_EDIT_ROLES` puede agregar un correo como lector o
editor y quitar permisos directos; nunca se permite quitar al propietario,
permisos heredados ni a la cuenta OAuth conectada.

Solo `PROJECT_EDIT_ROLES` con acceso al proyecto recibe además el estado de los
destinatarios esperados: liderazgo activo (admin, directivo y financiero),
creador activo, asignados activos y los gerente/co-gerentes vinculados al
proyecto. Un permiso efectivo directo, heredado, de dominio o público evita un
falso "sin acceso"; un rol inferior a editor se muestra como insuficiente. Drive
no permite comprobar la membresía individual de grupos, por lo que la interfaz
lo comunica como una limitación y no afirma acceso o ausencia con certeza.

Los fallos solo se clasifican como `NO_GOOGLE_ACCOUNT` si el mensaje de Google lo
indica explícitamente. Un dominio corporativo o `invalidSharingRequest` genérico
no permite inferirlo. Los demás códigos persistidos son
`POLICY_OR_RESTRICTION` y `TRANSIENT_OR_UNKNOWN`.

Al asignar colaboradores, aceptar cotizaciones, instanciar plantillas/ajustes o
agregar/cambiar responsables, el sistema sincroniza de forma secuencial y
aditiva el conjunto actual de interesados como `writer`. Nunca revoca
automáticamente a antiguos asignados. Si Drive falla, la mutación de negocio se
mantiene exitosa y la respuesta incluye `driveWarning`; el reintento no vuelve a
crear la tarea o asignación. La creación y la recreación comparten con
administradores, directivos, financieros, creador, gerente principal, co-gerentes
y asignados actuales.

## Una sola tarea en progreso por colaborador

Cada colaborador puede tener **una sola** tarea en `in_progress`. Así los
administrativos ven en qué está trabajando en este momento. El resto queda en
`paused` (**Pausada**).

| Acción | Endpoint | Efecto |
|--------|----------|--------|
| Tomar tarea | `POST /api/projects/[id]/tasks/[tid]/start` | `not_started` → `in_progress`; las demás tareas en progreso del asignado pasan a `paused` |
| Pausar | `POST /api/projects/[id]/tasks/[tid]/pause` | `in_progress` → `paused` (sirve también para pausar la única activa) |
| Reanudar | `POST /api/projects/[id]/tasks/[tid]/resume` | `paused` → `in_progress`; la tarea en progreso del asignado se pausa sola |
| Editar estado | `PATCH /api/projects/[id]/tasks/[tid]` | Poner `in_progress` a mano aplica la misma pausa automática; `paused` solo se acepta desde `in_progress` |
| Crear tarea | `POST /api/projects/[id]/tasks` | Crearla en `in_progress` pausa las demás del asignado; no se puede crear en `paused` |

- Pueden pausar y reanudar el colaborador asignado y los roles de liderazgo
  (`TASK_OVERRIDE_ROLES`), igual que al tomar una tarea. La regla también aplica
  cuando se pausa o reanuda desde `PATCH`.
- Una tarea pausada no admite reportar avance, completar ni validar: primero hay
  que reanudarla.
- Cada pausa queda en `task_transitions`. Las pausas automáticas se registran con
  la nota "Pausada automáticamente al activar otra tarea".
- `start` y `resume` devuelven `pausedTaskIds` con las tareas pausadas
  automáticamente, y la interfaz las informa en un aviso.
- Los cambios corren en una transacción que bloquea la fila del usuario. Así, dos
  solicitudes simultáneas no pueden dejar dos tareas en progreso.
- La migración `018_task_paused_status.sql` solo agrega el estado. Las tareas que
  ya estaban en progreso no se modifican; la regla se aplica la próxima vez que el
  colaborador toma o reanuda una tarea.

## Inversión y precio de venta del proyecto

El detalle de un proyecto muestra arriba un panel compacto con mini gráficos:
**Horas**, **Invertido** (con el detalle por colaborador), **Venta** y
**Margen**. Un selector pequeño filtra por versión (por defecto, todas).

| Qué | Dónde | Quién |
| --- | --- | --- |
| Sueldo mensual de un interno | Ficha del colaborador (`PATCH /api/users/[id]` con `monthly_salary`, número >= 0) | Admin |
| Horas semanales de trabajo (ley) | Configuración → General (`PATCH /api/settings` con `weekly_work_hours`, mayor que 0 y máximo 60; por defecto 42) | Admin |
| Ver horas, dinero y margen | `GET /api/projects/[id]/financials` (opcional `?adjustment_id=<id>` para una versión) | Admin, directivo, financiero y el comercial que creó el proyecto |
| Anotar en cuánto se vendió | `PATCH /api/projects/[id]/financials` con `{ "sale_price": number \| null }` | Admin, directivo y el comercial que creó el proyecto |
| Ver cuánto valió una tarea | Ojito de la tarea (`GET /api/projects/[id]/tasks/[tid]/cost`) | Admin, directivo y financiero |
| Corregir el costo de una tarea externa completada | Lápiz en el ojito de la tarea (`PATCH /api/projects/[id]/tasks/[tid]/cost` con `{ "completion_cost": number }`, >= 0) | Admin y directivo |

Cómo se calcula el dinero invertido:

- **Internos**: minutos registrados × valor del minuto del mes. El valor del
  minuto es `sueldo mensual / minutos laborables del mes`: días de lunes a
  viernes del mes, sin festivos de Colombia (fijos, Ley Emiliani y los de
  Semana Santa), × minutos por día (`horas semanales × 60 / 5`; 42 h → 504 min).
  Por eso un mes con menos días laborables (febrero) sale más caro por minuto.
  Ejemplo con 42 h: febrero de 2026 tiene 20 días (10.080 min) y marzo de 2026,
  21 días por el festivo del 23 (10.584 min).
- **Mes de la tarea**: se usa el mes en que se completa (hora de Bogotá). Al
  completarla se congelan en `project_tasks` el sueldo
  (`completion_monthly_salary`), los minutos del mes
  (`completion_month_minutes`) y la tarifa por hora resultante
  (`completion_hourly_rate`). Si luego cambian el sueldo o las horas semanales,
  las tareas terminadas conservan su histórico; solo las tareas aún sin
  completar se valoran con el sueldo actual y los minutos del mes actual.
- **Externos**: el costo que declaran al completar la tarea o, si no hay, el
  precio de la cotización aceptada. Declarar el costo es obligatorio (también
  para colaboradores sin la casilla de interno marcada), pero 0 es válido: así se
  registra el trabajo gratis, como revisiones o ajustes. Solo se rechaza un costo
  ausente o negativo.
- **Corrección del costo de un externo**: si un externo se equivoca, admin o
  directivo corrigen el valor desde el ojito de la tarea (0 es válido). Solo
  aplica a tareas completadas de externos; las tareas internas se valoran con el
  sueldo y no se editan (`400`). Queda rastro: `completion_cost_original` guarda
  el valor que declaró el externo antes de la primera corrección (no cambia en
  correcciones posteriores; `NULL` si nunca se corrigió o no había valor), y
  `completion_cost_updated_by` / `completion_cost_updated_at` dicen quién y
  cuándo. El ojito lo muestra: "Corregido por {nombre} el {fecha} · valor
  declarado {valor}". Así los externos pasan su cuenta de cobro con lo que
  aparece en MIC: lo que no está en MIC no se paga. Financiero solo lo ve;
  comercial y colaborador no ven costos.
- **Recálculo único**: al guardar el sueldo mensual de un interno (mayor que 0),
  sus tareas ya completadas que aún no estaban congeladas con sueldo mensual (sin
  precio externo ni cotización aceptada) se recalculan una sola vez con el mes en
  que se completaron. Las tareas ya congeladas con sueldo mensual no vuelven a
  cambiar.
- El sueldo mensual reemplaza al valor de la hora por colaborador. La columna
  `users.hourly_rate` sigue en la base, pero la aplicación ya no la usa.
- **Filtro por versión**: `?adjustment_id` (id de `project_adjustments`) cuenta solo
  las tareas de esa versión. Un valor que no es entero positivo responde `400
  { "error": "Versión inválida" }`; una versión de otro proyecto, `404
  { "error": "Versión no encontrada" }`. La respuesta siempre incluye
  `versions: [{ id, version_number }]` y `adjustment_id` (el filtro o `null`).
- El precio de venta y el margen son de todo el proyecto: con un filtro de
  versión, `sale_price` sigue siendo el del proyecto y `margin` es `null`.
- Los gráficos usan `recharts` a través del componente `chart` de shadcn.
- Migraciones: `019_project_financials.sql`, `020_monthly_salary_cost.sql` y
  `021_task_cost_correction.sql`.

## Notificaciones por correo

`dispatchNotification` (`app/lib/services/notificationEngine.ts`) registra cada
evento en `notification_events` y envía los correos después de que la mutación
confirma; un fallo de correo nunca rompe la mutación. Las entregas fallidas se
pueden reintentar desde `POST /api/notification-deliveries/[id]/retry`.

### Tarea lista para ejecutar (`task.ready`)

Avisa al **colaborador asignado** que la tarea ya está lista para que la ejecute
("está en tu cancha"). Es distinto de `task.assigned`, que solo avisa la
asignación. Se envía cada vez que una tarea **con responsable** queda en
`not_started`:

| Origen | Cuándo |
|--------|--------|
| Crear tarea (`POST /api/projects/[id]/tasks`) o ajuste (`POST /api/projects/[id]/adjustments`) | La tarea se crea ya activa; llega después de `task.assigned`, así que el primer colaborador recibe los dos correos |
| Completar (`.../tasks/[tid]/complete`) o validar (`.../tasks/[tid]/validate`) | Se activa la siguiente tarea (o la primera de corrección al rechazar). Si queda `blocked` no se envía |
| Editar (`PATCH .../tasks/[tid]`) | El estado cambia a `not_started` desde otro estado |
| Eliminar o reordenar (`DELETE .../tasks/[tid]`, `POST .../tasks/reorder`) | La siguiente tarea pendiente pasa de `waiting` a `not_started` |
| Aceptar cotización (`PATCH .../tasks/[tid]/quotes/[qid]`) | La tarea queda `not_started` con el colaborador aceptado; llega después de `quote.accepted` |

El correo incluye la descripción de la tarea, el enlace al proyecto y, si existe,
la carpeta de Drive. Las tareas en `waiting` o `blocked`, o sin responsable, no
lo reciben.

### Cierre automático y nuevas tareas

Cuando todas las tareas de la **última versión** están completadas, el proyecto
y esa versión pasan automáticamente a `completed`. Una versión vacía no se
completa, y el progreso se limita a 99% mientras quede alguna tarea pendiente.

En un proyecto completado siguen disponibles dos acciones independientes:
- **Agregar tarea**: agrega trabajo a la última versión. Si queda trabajo pendiente,
  el proyecto vuelve a **Activo**, esa versión se reabre y se recalcula el avance.
  Las tareas ya completadas no cambian de estado.
- **Crear ajuste**: crea una nueva versión; las anteriores conservan su historial.
  Solo se permite (botón y `POST /api/projects/[id]/adjustments`) cuando la última
  versión tiene al menos una tarea y todas sus tareas reales están completadas,
  sin importar el estado o el progreso guardado del proyecto o de la versión.
  Una versión vacía o inexistente no habilita el ajuste; el rechazo (400) ocurre
  antes de crear carpetas en Drive o escribir datos.

Solo la última versión admite tareas nuevas desde `POST /api/projects/[id]/tasks`.
El selector muestra el estado completado, pero el cierre ya no requiere un botón manual.
Los estados se sincronizan dentro de una transacción, bloqueando el proyecto antes
 de contar las tareas. No se aplica ninguna migración retroactiva.

### Aviso de cierre al comercial (`project.ready_to_close`)

Se conserva el identificador del evento para compatibilidad con historial y reintentos.
El asunto es `[<proyecto>] Tu proyecto se completó al 100%`, con un botón "Ver proyecto".
Se envía al **comercial** (`projects.created_by`) cada vez que el proyecto pasa a
completado, incluido después de reabrirlo y terminar nuevas tareas. El remitente
sigue siendo quien provocó la transición. Recalcular un proyecto ya completado no
repite el aviso. Sin comercial no hay destinatario.

`?notify=false` suprime el correo, no la actualización de estados. Se retiró el
correo `project.completed`: solo queda el aviso del 100% al comercial. El endpoint
de cierre manual se conserva para compatibilidad, pero ya no envía correos.
Los envíos antiguos siguen en el historial; reintentar un `project.completed`
fallido responde 410 sin enviar ni incrementar su contador de reintentos.

### Creación de proyectos con el wizard

El wizard (`WizardStep6Confirm`) arma las tareas en varias peticiones: agregar
el producto (instancia las plantillas sin correos), eliminar, editar, crear
tareas extra y reordenar. Esas peticiones de tareas llevan `?notify=false`, que
silencia `task.assigned`, `task.reassigned` y `task.ready` para que nadie reciba
un correo de una tarea que luego cambia de responsable o de posición. Las
solicitudes de cotización (`quote.requested`) no se silencian. El valor por
defecto es `notify=true`; un valor distinto de `true`/`false` responde 400.

Al final, con la lista de tareas ya definitiva, el wizard llama una sola vez a
`POST /api/projects/[id]/tasks/notify-created` (`OPERATIONS_ROLES`). Este
endpoint envía `task.assigned` a cada tarea de la versión base (v1) que tiene
responsable y después `task.ready` a las que están en `not_started`, así que el
primer colaborador recibe los dos correos. Luego envía `quote.requested`
("Te invitaron a cotizar") a cada invitación de cotización pendiente de esas
tareas: las plantillas registran invitados en `task_quote_invitations` sin
enviarles correo. Una invitación está pendiente si la tarea no está
`completed` y el invitado aún no envió su cotización. Responde
`{ notified: { assigned, ready, quoteRequested } }`. Omite las tareas que ya
tienen ese evento registrado y, para cotizaciones, el par tarea/invitado que ya
tiene un `quote.requested` con ese `invitee_user_id` (por ejemplo, las tareas
extra del wizard, que ya lo enviaron al crearse). Por eso, llamarlo dos veces
no duplica correos. Si falla, el
proyecto queda creado y el wizard solo muestra un aviso.

## Auditoría e historial

| Tabla | Registra |
|-------|----------|
| `manager_client_history` | Traslados de un gerente entre clientes |
| `project_manager_history` | Cambios de gerente responsable de un proyecto |
| `brand_manager_history` | Cambios de gerente responsable de una marca |
| `task_transitions` | Cambios de estado de las tareas de proyecto |
| `notification_events` | Eventos de notificación emitidos (con reintentos en `notification_deliveries`) |

Las tres tablas de historial de gerente guardan `changed_by` (usuario que ejecutó
el cambio), `reason` y `changed_at`. `task_transitions` usa su propio esquema
(`from_status` / `to_status`, `from_flag` / `to_flag`, `moved_by`, `notes`,
`transitioned_at`).

## Puesta en marcha

```bash
npm install
npm run db:migrate     # aplica db/migrations/*.sql pendientes
npm run db:seed        # datos de ejemplo (--reset para limpiar antes)
npm run dev            # http://localhost:3000
```

### Scripts

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Servidor de desarrollo con Turbopack |
| `npm run build` / `npm run start` | Build y arranque de producción |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm test` / `test:watch` / `test:coverage` | Jest |
| `npm run db:migrate` | Runner de migraciones |
| `npm run db:seed` / `db:seed:reset` | Semillas |
| `npm run db:reset` | Borra el esquema `public` y vuelve a migrar y sembrar (solo local: **pierde todos los datos**) |

### Migraciones

`npm run db:migrate` ejecuta `db/migrate.ts`. Carga `.env.local` y si no existe
`.env`, crea la tabla de control `_migrations`, lee `db/migrations/*.sql` en
orden alfabético (el prefijo `NNN_` fija el orden), salta las ya aplicadas y
corre **cada migración en su propia transacción**: si una falla hace `rollback`,
informa qué archivo fue y detiene el proceso.

Elige la base de datos según `NODE_ENV`:

- `NODE_ENV=production` → `DATABASE_URL`
- cualquier otro valor → `DATABASE_LOCAL_URL` (con fallback a
  `postgresql://localhost/made_in_casa`)

La aplicación (`app/lib/db/index.ts`) usa el mismo criterio, salvo que en
desarrollo cae a `DATABASE_URL` si `DATABASE_LOCAL_URL` no está definida.

`024_align_project_manager_with_brand.sql` **reescribe datos**: alinea el gerente
de cada proyecto con el de su marca principal (en cualquier estado; marcas sin
gerente se omiten), registrando antes cada cambio en `project_manager_history`
con el motivo "Alineación con el gerente de la marca principal (migración 024)".
Es idempotente. Revisa qué proyectos cambiarían antes de aplicarla en producción.

### Variables de entorno

Requeridas:

| Variable | Uso |
|----------|-----|
| `SESSION_SECRET` | Firma del JWT de sesión |
| `DATABASE_URL` | Conexión en producción |
| `DATABASE_LOCAL_URL` | Conexión en desarrollo |

Opcionales:

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_APP_URL` | Base para redirect URIs de OAuth y enlaces en correos (por defecto `http://localhost:3000`) |
| `NEXT_PUBLIC_BACKEND_API` | Base de la API para el cliente (`app/config/constants.ts`) |
| `REQUIRE_GMAIL_CONNECTION` | `true` obliga a los no-admin a conectar Gmail antes de operar |
| `NOTIFICATION_FROM_EMAIL` / `NOTIFICATION_FROM_NAME` / `NOTIFICATION_REPLY_TO_EMAIL` | Remitente de las notificaciones del sistema |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_SECURE` | Transporte SMTP de respaldo |
| `SIIGO_USERNAME` / `SIIGO_ACCESS_KEY` / `SIIGO_API_URL` | Integración con Siigo |

Las credenciales OAuth de Google se administran desde `/settings` y se guardan en
la base de datos, no en variables de entorno.

## Convenciones

- Las rutas de API validan el cuerpo con **Zod** dentro del handler.
- Las respuestas paginadas devuelven `{ data, pageCount, currentPage, total }`
  usando `ITEMS_PER_PAGE` de `app/config/constants`.
- Los errores se devuelven como `{ error }` con el status 4xx/5xx adecuado.
- El frontend consume la API con `app/lib/services/apiService.ts`
  (`get/post/patch/del`), nunca con `fetch` ad hoc.
- Las mutaciones en `app/lib/queries/**` llaman a `revalidatePath`.
- Todo feature o endpoint nuevo llega con sus tests en `__tests__/`.
