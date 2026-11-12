# Task detail sheet (Mis Tareas)

Right-side work panel for collaborators in Mis Tareas, implementing design/task-detail-sheet/03-workspace-split.html (chosen artboard; 01 and 02 are alternatives).
Branch: feat/task-detail-sheet.

## Specs

- S1: "a los colaboradores agregarles en cada tarea en mis tareas el link al drive y un boton a las notas, o algo para que no se salga de alli"
- S2: "una pestaña que salga desde la parte derecha de la pantalla tipo sheet ... donde este todo el detaller para hacer la tarea ... cuando de clic a la tarea o a tomar tarea"
- S3: "que ya no deje hacer clic al proyecto dentro de la tarea" (the project title in the card is plain text; the project is reachable only from the sheet link, new tab).
- S4: "debe aparecer el estado de la tarea el tiempo, el link al drive el link al proyecto, las notas, el historial de tareas antes de con el ojito para ver las notas con el entregable"
- S5: "debe estar la tarea y la descripcion cuando se le asigno" and "buena UX para que no sea un mundo de informacion que no se lea".
- S6: Layout per artboard 03: brief + project notes on the left, time / Drive / project / previous tasks on the right; stacked single column on small screens.
- S7: The new context endpoint only returns data to users allowed to access the task's project (same rule as task history).

## Tasks

- T1 (S1, S4, S7) — query `getTaskWorkContext` + `GET /api/projects/[id]/tasks/[tid]/context` with tests — inline — commit: bfb9918 (slice 1, ~444 lines)
- T2 (S2-S6) — shadcn Sheet + `TaskWorkSheet` + MyTasksClient wiring (card click, Tomar tarea, plain project text) + README — inline + worker (component test, README) — commit: see L5 (slice 2)

## Log

- L1: User request (verbatim): "a los colaboradores agregarles en cada tarea en mis tareas el link al drive y un boton a las notas, o algo para que no se salga de alli / o me gustaria algo mas como una pestaña que salga desde la parte derecha de la pantalla tipo sheet o algo asi / donde este todo el detaller para hacer la tarea asi bien bonito que cuando de clic a la tarea o a tomar tarea, y que ya no deje hacer clic al proyecto dentro de la tarea / debe aparecer el estado de la tarea el tiempo, el link al drive el link al proyecto, las notas, el historial de tareas antes de con el ojito para ver las notas con el entregable, / debe quedar con buena UX para que no sea un mundo de informacion que no se lea, debe estar la tarea y la descripcion cuando se le asigno etc, de esto dame 3 ejemplo con gentle desing a ver cual escojo"
- L2: User chose artboard design/task-detail-sheet/03-workspace-split.html; 01-tabs-sheet and 02-guided-scroll are alternatives.
- L3: Decisions: Drive link prefers the task's version folder (project_adjustments.drive_folder_url) and falls back to the project folder; notes = project notes plus version notes when present; "historial de tareas antes" = completed tasks of the same project (excluding this one), newest first, each with delivery_url and completion notes. Assigner is not stored, so the sheet shows the project creator; no estimated time or due date exists, so time shows worked minutes and progress.
- L4: Verify (gentle-ai-verify) on S1-S7: no blockers; S7 same rule as history endpoint; exposure not widened. Advisory applied: shared `isHttpUrl` in app/lib/utils.ts guards Drive/deliverable links (test added, RED then GREEN). Full suite 209/209 suites, 1762 tests green; tsc and eslint clean. S5/S6 visual layout not browser-verified.
