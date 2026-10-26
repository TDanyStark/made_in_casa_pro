# Brand-owned project manager
A project's manager is always the current manager of its principal brand; it changes only by reassigning the brand.
Branch: feat/brand-owned-project-manager (from main bae40fb). No push, no production DB writes without the user.

## Specs
S1. "la forma de cambiar un proyecto de gerente es asignarle la marca a otro gerente" — changing a brand's manager (updateBrand / brand PATCH, ChangeManager UI) also sets `manager_id` of ALL projects whose principal brand (`projects.brand_id`) is that brand, any status (user choice "Sí, todos los proyectos de la marca"), in the same transaction as the brand update and its `brand_manager_history` row; each changed project gets a `project_manager_history` row (previous, new, changed_by, reason). Drive access of affected projects is re-synced like the current project manager change does (best effort, never blocks).
S2. "cada vez que se cambia el gerente de una marca queda en el historial, esto servira para luego saber por ejemplo quienen fueron los gerentes que empezaron un proyecto, lo hariamos viendo la fecha de creacion de un proyecto y quien era el gerente en ese tiempo" — brand_manager_history must keep being written on every brand manager change (with changed_at); do not remove or rewrite it.
S3. Manual project manager change is removed (user choice "Sí, quitarlo (Recomendado)": "La tarjeta muestra el gerente y el historial, con una nota: «para cambiarlo, reasigna la marca». El PATCH deja de aceptar manager_id."). PATCH /api/projects/[id] with `manager_id` → 400 `{ error: "El gerente del proyecto se cambia reasignando su marca" }`, nothing written. ProjectManagerCard keeps the manager name and history, without the select.
S4. Consequence of S1/S3 in the manager transfer (previous feature, managers.ts transferManager + TransferManagerDialog): projects always follow their brand's new manager; explicit per-project reassignment is removed (dialog and `projectReassignments` input), since it would set a project manager different from its brand's.
S5. Creation: createProject sets `manager_id` to the principal brand's manager; a POST whose `manager_id` differs from it → 400 (DomainError, e.g. `MANAGER_NOT_BRAND_MANAGER`), nothing written. The wizard already sends the brand's manager.
S6. Existing data: projects whose manager differs from their principal brand's manager are aligned by a migration (024) that records project_manager_history rows. The migration is written and tested for SQL shape only; it is NOT run until the user approves (it rewrites production data).

## Tasks
T1 | — | allow editing associated brands on completed projects (previous request) | inline | done 4ee4ea7 (full Jest 1513 passed; tsc 0; eslint 0)
T2 | S1,S2,S3,S4,S5,S6 | brand change cascade + Drive sync, remove manual project manager change (API, query, card), transfer without per-project choice, creation check, migration 024; tests; README | gentle-ai-worker | pending

## Log
L1. "una cosa, cuando ya esta creado un proyecto puedo agregarle mas marcas?" → "no veo donde se agregan mas" (screenshot: project 80 completed, card read-only) → choice "Permitir editarlas también en completados" → T1.
L2. "ven ya que estoy viendo como es que a un proyecto puedo cambiarle el gerente si los proyectos estan linkeados es a una marca, la forma de cambiar un proyecto de gerente es asignarle la marca a otro gerente"
L3. Answers: cascade → "(custom) algo importante es que cada vez que se cambia el gerente de una marca queda en el historial, esto servira para luego saber por ejemplo quienen fueron los gerentes que empezaron un proyecto, lo hariamos viendo la fecha de creacion de un proyecto y quien era el gerente en ese tiempo"; manual change → "Sí, quitarlo (Recomendado)"; confirmation → "Sí, todos los proyectos de la marca".
L4. Engram mirror unavailable in this session (no memory tools).
