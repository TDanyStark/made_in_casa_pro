# Plan: Project Metadata + Rol Financiero

## Resumen

Trabajo aprobado en dos frentes que deben salir coordinados:

1. **Nuevos metadatos de proyecto**
   - `fecha_entrega_ideal` (fecha + hora)
   - `oc` (string opcional)
   - `cierre` (fecha + hora)
2. **Nuevo rol `financiero`** con el mismo alcance funcional que `directivo`
3. **Centralización de permisos** para reducir duplicación antes de expandir roles

> Nota clave: **`cierre` NO significa finalización operativa del proyecto**. Debe modelarse y mostrarse como un hito de **facturación / cierre administrativo**, separado de `completed_at`, que sigue representando terminación del proyecto.

---

## Dependencias entre fases

```text
Fase 1 (permisos centralizados) ──┐
                                  ├─ Fase 2 (rol financiero)
Fase 3 (schema + tipos proyecto) ─┼─ Fase 4 (create/edit flows)
                                  └─ Fase 5 (detalle + QA + rollout)
```

- La **Fase 1** debe ocurrir antes o durante el rollout de `financiero`.
- La **Fase 3** habilita API/UI para create y edit.
- La **Fase 5** depende de que create/edit ya persistan los 3 campos nuevos.

---

## Fase 1 — Centralización de permisos

> Objetivo: dejar una fuente única para permisos compartidos y evitar repetir arrays manuales en navegación, middleware y endpoints.

### 1.1 Inventario y agrupación de roles
- [ ] Identificar todos los lugares donde hoy se repiten combinaciones como `ADMIN + DIRECTIVO + COMERCIAL` o `ADMIN + DIRECTIVO`.
- [ ] Definir grupos reutilizables, por ejemplo:
  - `LEADERSHIP_ROLES = [ADMIN, DIRECTIVO, FINANCIERO, COMERCIAL?]` solo si aplica realmente
  - `DIRECTIVO_SCOPE_ROLES = [DIRECTIVO, FINANCIERO]`
  - `PROJECT_EDIT_ROLES = [ADMIN, DIRECTIVO, FINANCIERO, COMERCIAL]`
  - `PROJECT_VIEW_ROLES = [ADMIN, DIRECTIVO, FINANCIERO, COMERCIAL, COLABORADOR]`
- [ ] Mantener separación entre:
  - permisos de navegación
  - permisos de rutas protegidas
  - permisos de endpoints API

### 1.2 Refactor base
- [ ] Crear o adaptar un módulo central de permisos/roles (idealmente apoyado en `app/lib/permissions.ts` o un archivo hermano como `app/lib/role-groups.ts`).
- [ ] Hacer que `LinksData.ts` consuma grupos compartidos en vez de arrays escritos a mano cuando sea viable.
- [ ] Revisar `validateApiRole(...)` usages para migrar primero los endpoints de proyectos/usuarios/configuración más sensibles al nuevo esquema.

### 1.3 Checkpoint de validación
- [ ] Confirmar que la navegación visible y no visible conserva el comportamiento actual para `admin`, `directivo`, `comercial` y `colaborador`.
- [ ] Ejecutar y/o ampliar `__tests__/lib/permissions.test.ts` para cubrir el nuevo modelo centralizado.

### Riesgos de la fase
- Cambiar permisos “por grupo” puede abrir o cerrar rutas accidentalmente si no se validan equivalencias exactas.

---

## Fase 2 — Alta del rol `financiero`

> Objetivo: introducir el rol nuevo con alcance idéntico a `directivo`, apoyándose en la centralización anterior.

### 2.1 Datos y modelo
- [ ] Agregar el rol `financiero` en seed/migración de datos según corresponda para ambientes nuevos y existentes.
- [ ] Extender `UserRole` en `app/lib/definitions.ts` y revisar cualquier comentario o tipado que asuma solo 4 roles autenticados.
- [ ] Confirmar el ID final del rol en DB para evitar desalineación entre enum, seeds y sesión JWT.

### 2.2 Permisos efectivos
- [ ] Incluir `financiero` en todos los permisos donde hoy entra `directivo`, sin ampliar más alcance que ese.
- [ ] Replicar acceso en:
  - navegación (`LinksData.ts`)
  - permisos de ruta (`permissions.ts`)
  - endpoints API relevantes (`projects`, `tasks`, `products`, `clients`, etc.)
  - checks de UI como `canEdit`

### 2.3 Checkpoint de validación
- [ ] Verificar que un usuario `financiero` vea exactamente lo mismo que `directivo` en menú, listados, detalle y acciones permitidas.
- [ ] Agregar pruebas unitarias/integración mínimas para equivalencia `directivo === financiero` en permisos críticos.

### Riesgos de la fase
- Hay indicios de inconsistencia histórica entre seeds de roles y usuarios; validar primero antes de asumir IDs estables.

---

## Fase 3 — Schema, queries y contratos de proyecto

> Objetivo: habilitar almacenamiento y lectura consistente de los 3 nuevos campos.

### 3.1 Base de datos
- [ ] Crear una nueva migración SQL en `db/migrations/` para agregar a `projects`:
  - `ideal_delivery_at TIMESTAMPTZ NULL` (o naming acordado en snake_case)
  - `oc TEXT NULL`
  - `billing_closed_at TIMESTAMPTZ NULL` o `cierre_at TIMESTAMPTZ NULL`
- [ ] Definir nombres inequívocos para evitar confusión entre cierre operativo y cierre de facturación.
- [ ] Si se usa `cierre_at` en DB, documentar en código que es **billing-related**, no equivalente a `completed_at`.

### 3.2 Tipos y SELECTs
- [ ] Extender `ProjectType` y `ProjectDetailType` con los 3 nuevos campos.
- [ ] Actualizar `PROJECT_SELECT`, `getProjectById`, `getProjectDetail` y paginación en `app/lib/queries/projects.ts`.
- [ ] Decidir si los listados deben traer los campos aunque no se muestren; si no aportan valor fuera del detalle, priorizar uso principal en detalle.

### 3.3 Mutaciones y validación API
- [ ] Extender Zod en `app/api/projects/route.ts` (POST) y `app/api/projects/[id]/route.ts` (PATCH).
- [ ] Permitir create y edit de los 3 campos con nullables/opcionales bien definidos.
- [ ] Validar formato date-time y normalizar timezone de forma consistente.
- [ ] Mantener `completed_at` intacto y separado del nuevo `cierre`.

### 3.4 Checkpoint de validación
- [ ] Pruebas de queries para inserción/lectura/actualización.
- [ ] Pruebas de API para POST/PATCH con payload completo, parcial y nulls.

---

## Fase 4 — Flujos de create y edit

> Objetivo: permitir capturar/editar los nuevos datos sin exponerlos fuera de los lugares pedidos.

### 4.1 Create flow
- [ ] Extender `WizardState` en `app/hooks/useProjectWizard.ts` con los 3 campos nuevos.
- [ ] Actualizar el paso más apropiado del wizard:
  - opción recomendada: **Step 1 (Básicos)** para `fecha de entrega ideal` y `OC`
  - `cierre` puede ir en el mismo paso si el usuario debe poder cargarlo desde creación
- [ ] Reflejar los nuevos campos en `WizardStep6Confirm.tsx` al momento de hacer `POST /api/projects`.
- [ ] Evaluar si `ProjectPreviewCard` debe mostrar estos datos durante creación; si se agrega, que sea solo como preview del wizard, no como lista pública.

### 4.2 Edit flow
- [ ] Implementar edición en la vista de detalle existente (hoy no hay una página dedicada de edición; el proyecto se edita inline por tabs/componentes).
- [ ] Extender `ProjectInfoTab.tsx` para editar:
  - `fecha de entrega ideal`
  - `oc`
  - `cierre`
- [ ] Mantener `cierre` etiquetado explícitamente como **cierre de facturación** o equivalente.
- [ ] Invalidar React Query de `project` y `projects` tras guardar.

### 4.3 Reglas de visibilidad
- [ ] Los campos deben estar soportados en create/edit, pero mostrarse al usuario final **solo en detalle de proyecto**.
- [ ] No agregarlos en cards, tablas, dashboard ni breadcrumbs salvo que una necesidad funcional lo justifique después.

### 4.4 Checkpoint de validación
- [ ] Test de componente o integración del wizard con payload que incluya los nuevos campos.
- [ ] Test de componente o integración de `ProjectInfoTab`/detalle editando y persistiendo campos.

---

## Fase 5 — Presentación en detalle, QA y rollout

> Objetivo: cerrar la entrega con visibilidad correcta, pruebas y salida segura.

### 5.1 Detail view
- [ ] Mostrar los 3 campos en `ProjectInfoTab.tsx` y/o `ProjectHeader.tsx` solo si aportan contexto allí.
- [ ] Recomendación:
  - `fecha de entrega ideal`: en Información
  - `OC`: en Información
  - `cierre`: en Información, con helper text aclarando que corresponde a facturación
- [ ] Si un valor es null, usar fallback claro (`Sin definir`, `Sin OC`, `Sin cierre de facturación`).

### 5.2 QA funcional
- [ ] Caso 1: crear proyecto con los 3 campos y confirmar persistencia en detalle.
- [ ] Caso 2: crear proyecto sin `OC` ni `cierre` y confirmar que siguen siendo opcionales.
- [ ] Caso 3: editar solo `cierre` sin tocar `completed_at`.
- [ ] Caso 4: completar un proyecto/tareas y verificar que `completed_at` y `cierre` no se pisan entre sí.
- [ ] Caso 5: sesión `financiero` con mismo acceso que `directivo`.

### 5.3 QA automatizado recomendado
- [ ] `__tests__/lib/permissions.test.ts`
- [ ] Nuevos tests de API para `app/api/projects/route.ts` y `app/api/projects/[id]/route.ts`
- [ ] Nuevos tests de queries para `app/lib/queries/projects.ts`
- [ ] Tests de componentes para wizard y tab de información si la cobertura actual lo permite

### 5.4 Rollout
- [ ] Ejecutar migración en ambiente de staging y probar con datos reales.
- [ ] Verificar compatibilidad con proyectos existentes donde los 3 campos estarán en `NULL`.
- [ ] Si el feature se considera visible para usuarios finales, actualizar `README-RESUME.md` al momento de implementación.
- [ ] Comunicar a negocio la diferencia semántica entre:
  - `completed_at` = proyecto terminado operativamente
  - `cierre` = cierre/facturación administrativa

---

## Archivos candidatos por fase

### Permisos / rol
| Archivo | Cambio esperado |
|---|---|
| `app/lib/definitions.ts` | Extender `UserRole` y tipos relacionados |
| `app/lib/permissions.ts` | Centralización o consumo de grupos de permisos |
| `app/lib/LinksData.ts` | Incluir `financiero` vía grupos centralizados |
| `app/lib/services/api-auth.ts` | Sin cambio funcional grande, pero revisar compatibilidad con el enum nuevo |
| `db/seeds/001_roles.sql` | Agregar rol `financiero` |
| `db/seeds/009_users.sql` | Alinear usuarios seed con el rol existente |

### Proyecto / metadata
| Archivo | Cambio esperado |
|---|---|
| `db/migrations/00x_*.sql` | Nueva migración para los campos de proyecto |
| `app/lib/queries/projects.ts` | SELECT/INSERT/UPDATE de los nuevos campos |
| `app/api/projects/route.ts` | Zod + create payload |
| `app/api/projects/[id]/route.ts` | Zod + patch payload |
| `app/hooks/useProjectWizard.ts` | Estado del wizard |
| `app/components/projects/wizard/WizardStep1Basics.tsx` | Inputs de metadata en creación |
| `app/components/projects/wizard/WizardStep6Confirm.tsx` | Envío final del payload |
| `app/components/projects/ProjectInfoTab.tsx` | Visualización/edición en detalle |

### Tests
| Archivo | Cambio esperado |
|---|---|
| `__tests__/lib/permissions.test.ts` | Cobertura de centralización + `financiero` |
| `__tests__/queries/projects*.test.ts` | Crear o ampliar pruebas de queries |
| `__tests__/api/projects/*.test.ts` | Crear o ampliar pruebas de POST/PATCH |
| `__tests__/components/projects/*.test.tsx` | Cobertura de create/edit/detail si aplica |

---

## Riesgos globales

- **Riesgo de naming**: usar `cierre` sin aclaración puede inducir a confusión con término de proyecto; conviene un nombre técnico inequívoco en DB/código.
- **Riesgo de permisos dispersos**: si `financiero` se agrega antes de centralizar, es probable olvidar rutas o acciones.
- **Riesgo de enum/seed/session**: el sistema parece asumir IDs fijos de roles; cualquier desalineación rompería permisos o sesiones.
- **Riesgo UI**: si los nuevos campos se agregan en listados por accidente, se incumple el requerimiento de mostrarlos solo en detalle.

---

## Criterios de aceptación globales

- [ ] Se pueden crear proyectos con `fecha de entrega ideal`, `OC` y `cierre`.
- [ ] Se pueden editar esos 3 campos desde el flujo vigente de edición del proyecto.
- [ ] Los 3 campos se muestran únicamente en el detalle del proyecto.
- [ ] `cierre` queda explícitamente definido como dato de facturación/cierre administrativo.
- [ ] `cierre` no reemplaza ni altera `completed_at`.
- [ ] El rol `financiero` tiene exactamente el mismo alcance que `directivo`.
- [ ] La base de permisos queda más centralizada que el estado actual.
