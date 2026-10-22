# Single in-progress task per collaborator
A collaborator may hold only one 'in_progress' task; others move to the new 'paused' status automatically or via a pause button.
Migration authorized implicitly by the feature (new status value); no data rewrite of existing rows.

## Specs
S1. "el sistema solo deberia permitirle tener una en progreso"
S2. "las otras o la otra cuando quede esto aplicado deberia quedar en un estado que se llame en pausada debe activarse automaticamente"
S3. "o aparecer un boton de pausa tambien por si quieren pausar la unica que tienen en progreso"
S4. Existing collaborators with several in-progress tasks: "No tocarlas"
S5. Resuming a paused task while another is in progress: "La que está en progreso se pausa sola"
S6. Completing or reporting progress on a paused task: "No, primero hay que reanudarla"
S7. Who can pause and resume: "El asignado y los roles de liderazgo"

## Tasks
T1 | S1,S2,S4,S5 | inline: migration 018 + query helpers (start auto-pauses, pause, resume, manual PATCH) + tests | done | commit 1 (feat(tasks): single in-progress task)
T2 | S3,S5,S6,S7 | inline: pause/resume API routes, progress/complete guards, zod enums + tests | done | commit 1
T3 | S2,S3 | inline: UI (badge, My Tasks, project tasks tab, command center, history) + README + tests | pending | -

## Log
L1. User: "un colaborador me dice que el toma tareas y como son largas aveces le piden que toome otra entonces llega a tener hasta 5 en progreso, pero entonces los adminsitrativos no pueden saber en que esta en el momento exacto, el sistema solo deberia permitirle tener una en progreso, las otras o la otra cuando quede esto aplicado deberia quedar en un estado que se llame en pausada debe activarse automaticamente o aparecer un boton de pausa tambien por si quieren pausar la unica que tienen en progreso"
L2. User answers: existing multi in-progress -> "No tocarlas"; resume -> "La que está en progreso se pausa sola"; paused complete/progress -> "No, primero hay que reanudarla"; pause/resume -> "El asignado y los roles de liderazgo".
L3. Exploration: status CHECK in db/migrations/001_schema.sql:177; startTask in app/lib/queries/projectTasks.ts:508 (no transaction, no per-user limit); manual status change via updateProjectTask (PATCH) can also set in_progress; progress route guards status at app/api/projects/[id]/tasks/[tid]/progress/route.ts:58. No persistent-memory tools callable: Engram mirror unavailable.
L4. RED/GREEN T1: projectTasks.pause.test.ts 17 failed (pauseTask missing) -> 17 passed; manual PATCH test 1 failed -> passed. Old startTask test rewritten for the transaction (same behaviors). Command center "all statuses" detection was a hardcoded length 5; replaced by ALL_TASK_STATUSES and pinned with a test. Paused counts as an active predecessor when creating tasks. Start transition note changes from '' to null.
L5. RED/GREEN T2: pause/resume route tests failed (module missing) -> passed; start route refactored onto shared taskStateChange handler, existing start tests unchanged and green. S6 pinned: progress route 400 for paused, completeTask throws for paused. Backend slice alone: tsc clean, jest 831/831.
