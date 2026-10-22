# Adjustment eligibility from real latest-version tasks
"Crear ajuste" (button and POST /api/projects/[id]/adjustments) depends only on the real tasks of the latest version: at least one task and all of them completed.
No migration; financial feature and mail behavior untouched.

## Specs
User: "bueno aunque finalmente lo importante es poder agregar tareas aunque este al 100% o completado, o crear nuevos ajustes siempre y cuando la version anterior ya este al 100%"; then "bueno entonces arreglalo".
S1. A latest version with more than 0 tasks, all completed, allows a new adjustment, whatever the stored project or adjustment status is (active, in_adjustments, completed).
S2. The button mirrors the server rule; an empty version, a missing version or one with unfinished tasks is never eligible, even when stored progress/status says 100% or completed.
S3. Adding tasks to the latest version keeps working as before, and existing role checks stay.
S4. A rejected request performs no writes and no Drive side effects.

## Tasks
T1 | S1,S2,S4 | delegated: completed_task_count in getAdjustmentsByProject + shared eligibility rule + POST guard + tests | done
T2 | S1,S2,S3 | delegated: ProjectAdjustmentsTab button uses the shared rule + tests | done

## Log
L1. Exploration: UI allowed when projectStatus completed OR last adjustment status completed; POST required project.status completed AND last adjustment status completed (no-adjustment case allowed). Real counts already drive completion in recalculateProjectProgressWithTransition/completeProject (app/lib/queries/projects.ts).
L2. RED: 14 new tests failed before the fix (API rejected active/in_adjustments projects and stored-active versions whose tasks were all completed, accepted incomplete/empty/missing latest without hitting the guard; UI hid the button for active projects and showed it for completed status with unfinished/empty/missing latest; SQL lacked completed_task_count).
L4. Parent spot check: all 27 focused tests passed, tsc and git diff --check exit 0. Native assessment: medium, reviewDue=false (under_budget); no native review started. Changes are staged on fix/adjustment-completed-tasks, not committed or published. Existing check/create concurrency race remains outside this fix.
L3. GREEN: shared canCreateAdjustmentAfter in app/lib/definitions.ts used by ProjectAdjustmentsTab and POST; getAdjustmentsByProject adds COUNT FILTER completed_task_count. POST checks before body parse, Drive, or writes; one 400 message "No se puede crear un ajuste hasta que todas las tareas de la última versión estén completadas." Full: jest 120 suites / 1035 tests, tsc, eslint, diff --check clean. Not performed: real PostgreSQL, browser, concurrent requests (check is outside createProjectAdjustment's transaction).
