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

Reglas al trasladar:

| Caso | Resultado |
|------|-----------|
| Marca / proyecto **con sucesor** asignado | Se queda en el cliente viejo y cambia de gerente |
| Marca **sin sucesor** | Viaja con el gerente: `brands.client_id` = cliente destino |
| Proyecto **sin sucesor** | Sigue a **su marca**: `projects.client_id` = `brands.client_id` |

Orden obligatorio dentro de la única transacción:

1. Reasignar marcas y proyectos a sus sucesores (+ `brand_manager_history` /
   `project_manager_history`).
2. Mover al cliente destino las marcas que siguen apuntando al gerente.
3. Recalcular el cliente de los proyectos a partir del de su marca.
4. `UPDATE managers SET client_id` (y email / teléfono si cambian).
5. Insertar en `manager_client_history`.

Si se invirtiera el orden, los sucesores —validados contra el cliente viejo—
quedarían apuntando a un laboratorio que ya no es el suyo. Cualquier fallo hace
`rollback` completo.

Validaciones previas (fuera de la transacción, solo lecturas): `MANAGER_NOT_FOUND`,
`SAME_CLIENT`, `CLIENT_NOT_FOUND`, `EMAIL_IN_USE` (`managers.email` es UNIQUE
global) y `MANAGER_CLIENT_MISMATCH` cuando la marca/proyecto o el sucesor no son
del cliente que se está dejando, o cuando el sucesor es el propio gerente.

El resultado devuelve `reassigned_brands` / `reassigned_projects` (lo heredado por
sucesores) y `moved_brands` / `moved_projects` (lo que viajó con el gerente).

### Reasignación de gerente en un proyecto

`updateProject` (`app/lib/queries/projects.ts`) detecta el cambio de
`manager_id`, valida con `assertManagerBelongsToClient` contra
`projects.client_id` y ejecuta el `UPDATE` junto al insert en
`project_manager_history` en la misma transacción. El `client_id` del proyecto no
se toca. El historial se consulta en `GET /api/projects/[id]/manager-history`.

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
