# Manual project completion fallback
Restore the "Completado" choice in the project status selector as a validated fallback to automatic completion.
No database migration, live database, email sending, commit or push by the implementation worker.

## Specs
S1. "pero no me deja marcarlos como completado, me aparece en ajustes y el select de completado aparece como disabled, hay como una fuga logica alli"
S2. Accepted proposal: restore the manual "Completado" choice as a fallback; the server validates that ALL latest-version tasks are really completed (nonempty) and closes the project and the latest version together; keep automatic completion.
S3. Accepted proposal: do not restore the removed project.completed email; keep only the existing 100% commercial notification.
S4. User authorization: "sa dale, y mergea al main y haz push" (delivery owned by the parent).

## Tasks
T1 | S1 | ProjectHeader: enable "Completado"; selecting it calls POST projects/:id/complete instead of the generic PATCH; other statuses keep PATCH; backend failure shows its error and leaves the cache untouched; success refreshes project, versions (project-adjustments) and project list | done (component/mock verification) | not committed
T2 | S2 | completeProject: one write transaction; lock project then latest version (FOR UPDATE) before counting latest-version tasks; reject missing/empty/unfinished with existing messages and roll back; update project progress=100/status/completed_at and only the latest version; ignore stored rounded progress | done (unit/mock verification) | not committed
T3 | S3 | complete route stays silent (no dispatchNotification); automatic recalculation unchanged | done (route unchanged; silence pinned by tests) | not committed
T4 | S1-S3 | tests first (observed RED), then GREEN, full Jest, tsc, eslint on edited files | done; real PostgreSQL/browser checks not performed | not committed

## Log
L1. Exploration (base c94b347): selector disabled "completed"; completeProject trusted stored `project.progress` and ran two non-transactional updates over every `status = 'active'` version; route already sends no mail.
L2. RED: focused run (ProjectHeader, complete route, new projects.manualCompletion) 10 failed / 7 passed: Completado disabled, no POST, backend error not shown, and completeProject read via non-transactional db.execute. Route status/silence tests passed (pre-existing behavior pinned).
L3. GREEN: same 3 suites + projects.test.ts 46/46 passed. Full Jest 111 suites / 911 tests passed; tsc --noEmit exit 0; eslint on edited files exit 0; git diff --check exit 0.
L4. S3 rationale: the manual route sends nothing. The automatic 100% commercial notice already fires from recalculation when tasks finish; the manual fallback only closes states the recalculation should have closed, so emitting there would replay an already-issued notice. project.completed stays retired.
L5. Risk: real PostgreSQL lock behavior and browser Select interaction were not exercised; verification is unit/mock level.
