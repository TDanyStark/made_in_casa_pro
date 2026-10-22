# Project automatic completion and reopening
Connect project state, latest-version tasks and completion notices.
No database migration or publication is authorized.

## Specs
S1. "yo quiero que cuando llegue al 100% pase automaticamente a completado"
S2. "que me deje crear una tarea en la misma v1 y aparte me diga otro boton crear ajuste por si lo que quiero es crear un ajuste"
S3. "necesito que si esta completado y creo otra tarea pues deja de estar completado y pasa a Activo"
S4. "Solo en la última versión (recomendado)"
S5. "pero ahora quedaron 2 emails, el de completado y el del 100% dejemos solo el del 100% y quitemos el de completado"

## Tasks
T1 | S1-S4 | inline: transactional lifecycle and regression tests | done (unit/mock verification) | not committed
T2 | S2-S4 | inline: latest-version UI and consistent commercial notice/docs | done (component/mock verification) | not committed
T3 | S1-S4 | independent verification (concurrency), functional checks and native assessment | automated verification passed; real PostgreSQL/browser verification skipped for this delivery | see feature commit

T4 | S5 | inline: retire project.completed sends and retries; preserve history | done | not committed

## Log
L9. User authorized delivery despite the disclosed missing real-environment checks: "unelo a min poara que main siempre este actualizado, y push a origin para que se despliegue". Commit, merge into main and push are authorized. Browser and disposable PostgreSQL checks remain unperformed, not passed.
L1. User: "mira, yo quiero que cuando llegue al 100% pase automaticamente a completado, pero que me deje crear una tarea en la misma v1 y aparte me diga otro boton crear ajuste por si lo que quiero es crear un ajuste, necesito que si esta completado y creo otra tarea pues deja de estar completado y pasa a Activo"
L2. User selected "Solo en la última versión (recomendado)" to whether historical versions can receive new tasks.
L3. Exploration: calculation currently only counts active versions, rounds unfinished work to 100, and does not synchronize project/version status. Existing commercial notice requires wording aligned to automatic completion; retain event identifier for retry compatibility and avoid a second automatic notice.
L5. RED/GREEN: query suite 9 failed before transactional implementation, then 29 passed. UI regression reproduced missing Add task (1 failed/2 passed), then passed after separate creation capability. Template tests 3 failed before completion wording, then passed. First full suite: 800 passed/1 obsolete manual-button test failed; tsc caught the new test's invalid role string. Corrected the fixture and manual-button expectation; focused header/version suite and tsc passed. Final full run and independent verifier are in flight. ESLint on changed tracked TS/TSX passed.
L8. S5 checks: observed RED for manual route and legacy engine delivery, then 75 focused tests passed after retirement. Full suite 100 suites/801 tests passed (removed obsolete template tests, added retired retry test). TypeScript caught optional response in new test; corrected, then tsc and all 13 retry tests passed. ESLint and diff checks passed. Old template deleted, legacy events ignored before event creation, retries return 410 without sending. Historical labels/records preserved.
L7. User: "pero ahora quedaron 2 emails, el de completado y el del 100% dejemos solo el del 100% y quitemos el de completado". Reopen notification work only; retain the 100% commercial event and historic delivery records.
L6. Final self-check: 100 suites, 804/804 tests passed; tsc and git diff --check exit 0. Independent verify mvjrgfji-5-5uge: S1-S4 met at unit/mock level, 53 focused tests and tsc passed, no blockers found. Real PostgreSQL concurrency and browser checks remain unperformed. Advisory: latest-version validation and insertion are separate, so concurrent adjustment creation can race; products template insertion and manual completion compatibility remain baseline behavior. Parent authored adjustments.latest.test.ts and added historical-version component coverage during verification.
L4. Risk: item 4 (concurrent progress recalculations); item 3 (shared project queries). No callable persistent-memory tools available. Feature remains local; no push authorized.
