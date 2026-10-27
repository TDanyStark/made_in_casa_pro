# Brand-sourced project manager
The current project manager is always read from `brands.manager_id` via `projects.brand_id`; `projects.manager_id` stops being written and is dropped. Managers get no Drive access by default.
Branch: feat/brand-sourced-project-manager (from main 857d814). No push, no production DB writes or migrations without the user.

## Specs
S1. "normalmente ellos no tienen acceso a ese drive porque no tienen cuenta de google, entonces que por defecto ninguno tenga acceso al drive" + choice "Sí, tampoco co-responsables": project Drive recipients no longer include the principal manager nor co-managers (`manager` / `co_manager` sources); the wizard no longer shares the new folder with manager/co-manager emails; changing a brand's manager and adding/removing co-managers no longer re-sync Drive.
S2. Choice "Dejarlos como están": existing Drive permissions of managers are not revoked.
S3. "solo con gerente al crearse y cliente al crearse y el gerente y cliente actual": the project shows manager and client at creation and current manager and client (current = from the principal brand); the project manager history UI and its endpoint are removed. `project_manager_history` table is kept (no longer written nor shown).
S4. Objective (L1): "Eliminar `projects.manager_id` (o dejar de usarlo) para que el gerente actual se lea SIEMPRE de `brands.manager_id` vía `projects.brand_id`. Conservar `created_manager_id`, `client_id`, `project_manager_history` y `brand_manager_history`." Phases: read from brands → stop writing (026 drops NOT NULL) → drop column and index (027). API responses keep `manager_id`/`manager_name` (now from the brand).
S5. "si dale" to: "`brands.manager_id NOT NULL`" + "protegemos `brand_manager_history` contra el borrado en cascada" — `brands.manager_id` NOT NULL with ON DELETE RESTRICT; `brand_manager_history` FKs to `managers` ON DELETE RESTRICT instead of CASCADE.
S6. "no, solo lo que ves en el codigo": no external API consumers; only in-repo consumers must keep working.
S7. "no" (co-managers are not auto-removed): `project_managers` behavior unchanged.
S8. Manager transfer keeps requiring a successor for every brand; projects follow their brand without per-project writes; `followed_projects` stays in the response as the count of projects of the reassigned brands.

## Tasks
T1 | S1,S2,S7 | Drive without managers/co-managers; drop Drive re-sync on brand change and co-manager add/remove; wizard stops sharing manager emails; tests | inline | pending
T2 | S3,S4,S6 | read current manager from the brand everywhere (select/joins, filter, projectTasks commercial mode, transfer preview); remove history UI + endpoint; tests | inline | pending
T3 | S4,S5,S8 | stop writing projects.manager_id and project_manager_history (cascade, reassign, transfer followers, createProject); migration 026 (DROP NOT NULL, brands.manager_id NOT NULL RESTRICT, bmh RESTRICT); tests | inline | pending
T4 | S4 | migration 027 drop projects.manager_id + index; types; README; tests | inline | pending

## Log
L1. User request (read-only analysis): "Análisis (solo lectura): que `brands.manager_id` sea la única fuente de verdad del gerente de un proyecto … Objetivo a analizar: Eliminar `projects.manager_id` (o dejar de usarlo) para que el gerente actual se lea SIEMPRE de `brands.manager_id` vía `projects.brand_id`. Conservar `created_manager_id`, `client_id`, `project_manager_history` y `brand_manager_history`."
L2. Answers to open questions: "1. en vercel 2. si 3. normalmente ellos no tienen acceso a ese drive porque no tienen cuenta de google, entonces que por defecto ninguno tenga acceso al drive 4. solo con gerente al crearse y cliente al crearse y el gerente y cliente actual 5. si dale 6. no, solo lo que ves en el codigo 7. no"
L3. Choices: "Sí, implementa los 4 cortes"; existing access "Dejarlos como están"; co-managers "Sí, tampoco co-responsables".
L4. Engram mirror unavailable in this session (no memory tools).
