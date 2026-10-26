# Bug review fixes
Fix every bug listed in the consolidated bug review (L1/L2). Branch fix/bug-review-2025.
Token-at-rest encryption is postponed by user decision (L3). Engram mirror unavailable (no memory tools callable by parent).

## Specs
Each spec quotes the review item the user asked to fix ("necesito que arregles todos esos bugs").

### Security / auth (T1)
S1. "/api/roles: GET y POST sin validateApiRole — cualquier usuario crea roles." GET+POST validate method and role; POST ADMIN_ONLY_ROLES with Zod body.
S2. "Callback OAuth de Google Drive sin rol ni state — cualquiera reemplaza la cuenta Drive de toda la app." Callback requires ADMIN_ONLY_ROLES and a random `state` stored in an httpOnly cookie by /api/settings/google and compared in the callback.
S3. "OAuth Gmail sin state (login CSRF)" + "mensaje de error OAuth en la URL". Same state cookie pattern for /api/user-email/google; callback redirects with a fixed error code, never err.message.
S4. "Usuario desactivado puede seguir entrando (login no revisa is_active); el rol va en el JWT de 7 días." Login rejects inactive users; validateApiRole re-reads is_active and role from DB on every API call (user decision L3: "Releer usuario en cada API").
S5. "IDOR de lectura: cualquier autenticado ve detalle, tareas, historial, ajustes de cualquier proyecto (userCanAccessProject existe pero no se usa)." Apply userCanAccessProject for non-operations roles on project detail, project tasks list, task history, adjustments list, task quotes list. (Task GET in [tid]/route.ts is T2.)
S6. "/api/projects/[id]/recalculate" and "/api/siigo/customers" without role checks. recalculate: PROJECT_EDIT_ROLES; siigo customers: OPERATIONS_ROLES; both validateHttpMethod.
S7. "Token de Siigo completo en logs" (siigo/auth.ts:49) and "llamadas a Siigo sin timeout" + response.json() on non-JSON error body. Remove token log; AbortSignal.timeout; safe error parsing.
S8. "Hash de contraseña en respuestas PATCH /api/users/[id]" + 500 instead of 404 for missing user + internal error text in response. Strip password; 404; generic error.
S9. "Contraseña devuelta al cliente en errores de login." Never return submitted password in action state.
S10. "/projects/create queda capturada por el permiso de /projects/[id]." Exact static route match is authoritative before dynamic patterns.

### Tasks / quotes / data integrity (T2)
S11. "Un COLABORADOR puede editar cualquier tarea (reasignar, estado, cotizadores) y no se verifica que la tarea pertenezca al proyecto de la URL." PATCH restricted to OPERATIONS_ROLES (user decision L3: "Nada por PATCH"); PATCH/DELETE/GET return 404 when task.project_id !== URL project; GET task applies userCanAccessProject for non-operations roles.
S12. "Aprobar una validación borra minutos y costo: completeTask guarda progress_minutes=0 y completion_cost=null." progress_minutes is the total (L4): when provided it replaces, when absent the stored value is kept; same for completion_cost and delivery_url.
S13. "acceptQuote no valida estado de tarea ni cotización, sin lock; puede regresar tareas en progreso/completadas, aceptar una segunda cotización o de otra tarea; crash si la tarea no existe." Lock task FOR UPDATE inside the transaction; require quote pending, task blocked and unassigned, quote.task_id === URL task, task.project_id === URL project; 404/409 accordingly.
S14. "submitQuote puede regresar una cotización aceptada a pendiente." Reject submissions when the task is no longer open; never overwrite an accepted quote.
S15. "Doble liberación de conexión en el adaptador de BD." commit/rollback release at most once.
S16. "Completar tarea concurrente" and "rechazar validación duplica tareas; K=0 devuelve tarea inválida." Lock and re-check status inside the transaction; reject target order >= N.
S17. "order_index duplicado en tareas nuevas." Compute inside a transaction with a project lock.
S18. "Crear proyecto: dos inserts sin transacción." Single transaction.
S19. "Fallo al guardar invitaciones a cotizar se ignora y los correos se envían igual." Failure returns 500 and no QUOTE_REQUESTED emails.
S20. "Ajustes: marcar completado / borrar no filtran por project_id" + "número de versión de ajustes con carrera". Filter by project_id; lock project when computing version_number.
S21. "Valores interpolados en SQL (projectTasks.ts:451,511,661,807)." Use $n parameters.
S22. "quote no encontrada devuelve 500 y error.message crudo; rejectQuote sin revalidatePath."

### Integrations / list endpoints (T3)
S23. "Correos: deduplicación no atómica y deja pasar el envío si la BD falla." UNIQUE (event_id, recipient_email) via new migration + INSERT ... ON CONFLICT DO NOTHING; DB error means do not send.
S24. "Nombres en encabezados From/To sin codificar." RFC 2047 encode names and escape quotes.
S25. "page=0, limit=0 o valores no numéricos en listas devuelven 500 o pageCount=null." Shared Zod coerce validation (page int >=1, limit int 1..cap) returning 400, modeled on my-tasks.

### Frontend (T4)
S26. "XSS almacenado: HTML con dangerouslySetInnerHTML sin sanitizar." One shared SafeHtml component using DOMPurify replaces every dangerouslySetInnerHTML of user content.
S27. "Precio de venta: '1.500.000' se borra y '1.500' se guarda como 1,5." Parse COP digits only; reject NaN.
S28. "~20 queryFn devuelven [] cuando la API responde 401/500." Throw on !res.ok.
S29. "Borrar el texto del select no quita el filtro" + debounce rebuilt each render.
S30. "SiigoCustomersList hace una petición por tecla, respuestas fuera de orden, fetch ad-hoc."
S31. "ProjectNotesEditor ignora datos nuevos" + "doble click en borrar" + "useFetchWithParameters puede llamar a localhost".

## Tasks
T1 | S1-S10 | writer A (background) | done | 9ab2e27, 89b13bb
T2 | S11-S22 | writer B (background mvogtpyc-6-5dv5) | done | 5e30515, b145eba, e44553e
T3 | S23-S25 (S25 except app/api/projects/route.ts) | writer C (background mvogu9zu-7-7pat) | done | bb26363
T3b | S25 app/api/projects/route.ts (+ S4 visibility by DB role) | inline | done | 6e4fcc6
T4 | S26-S31 + UserLoginForm password follow-up | writer D (background mvogu9zw-8-ybvf) + inline follow-up | done | 7e2e4a8, e1b673c
T5 | S1-S25 | independent verify mvohewgo-9-lsjb (items 1,2,4) | done | -
T6 | S5,S17,S20,S24,S25 | writer (background mvohlgh6-a-iacw): verifier blocker + advisories | done | d84f58a

## Log
L1. User: "quiero que hagas una revision de posibles bugs de mi app"
L2. User: "necesito que arregles todos esos bugs" (referring to the consolidated report in this session).
L3. User decisions: COLABORADOR PATCH -> "Nada por PATCH (recomendado)"; Gmail token encryption -> "Posponer"; session -> "Releer usuario en cada API (recomendado)"; progress_minutes -> "No lo sé, revisa la UI".
L4. Evidence: TaskCompleteDialog.tsx:73 seeds accumulatedMinutes from task.progress_minutes and :176 submits it, so progress_minutes on complete is the total.
L5. T1 done: 55 RED -> 193/193 GREEN focused; full jest 132 suites / 1161 tests; tsc clean. Committed as 9ab2e27 (auth/session/OAuth state/passwords) and 89b13bb (route guards). Slice boundary: T1 alone is ~1840 authored lines incl. tests (over the ~400 guideline; security unit kept together). Follow-ups: one extra DB query per validateApiRole call; UserLoginForm.tsx password prefill moved to T4.
L6. Overlap checker treats bracket/paren/star paths conservatively: writers serialized after T1; app/api/projects/route.ts pagination moved inline (T3b); app/(admin)/** excluded from T4 (writer reports needed page edits).
L7. T3 done: 55 RED -> 148/148 GREEN focused. Migration 022 aborts on existing duplicates (pre-check query in header; not run on any DB). Brands keeps maxLimit 500 because MyTasksClient requests brands?limit=500. Committed bb26363.
L8. T3b inline: RED 6 failed (5 invalid pagination cases + JWT-role visibility) -> GREEN 11/11; GET /api/projects uses parsePagination and roleValidation.userRole (DB role) for COLABORADOR/COMERCIAL scoping. Committed 6e4fcc6.
L9. T2 done: RED per suite (adapter 2/5, access 13/22, projectTasks.integrity 18/20, taskQuotes.integrity 17/17, rule-errors 11, projects/adjustments 7/9) -> full jest 163 suites / 1362 tests green. Known gaps: PATCH saves invitations before task update (not atomic); rejection loop does not check same version; explicit completion_cost null now keeps stored cost. Frontend PATCH callers checked: /tasks command center is OPERATIONS_ROLES, ProjectTasksTab edits gated by canEdit, CollaboratorProjectView uses canEdit=false -> no collaborator PATCH path. tsc errors in projects route test fixed (05a3a5b). Commits 5e30515 (adapter), b145eba (projects/adjustments), e44553e (tasks/quotes). Slice boundary: backend fixes total ~5.5k authored lines incl. tests across 8 commits.
L10. Verify mvohewgo-9-lsjb on e44553e (scratch git archive, tsc 0, jest 153/1319): S1-S23 met, S24/S25 partially met. BLOCKER: S5 adjustments GET returns 403 to collaborators invited to quote but not assigned (userCanAccessProject only checks assigned tasks), breaking /my-quotes/projects/[id] (baseline 200). Advisories: FOR UPDATE on project row in createProjectTask can deadlock with completeTask FK inserts (use FOR NO KEY UPDATE); systemEmailProvider names unescaped; siigo/customers still parseInt; markAdjustmentAsCompleted reports success on foreign id; middleware and api/me still use JWT role. Unverified: real PostgreSQL, migration 022, concurrency. Verifier scratch dir left at /var/folders/7f/36n3mxgj1m96qbr4q9998htw0000gn/T/tmp.pET7jG1M4w.
L11. T6 done: RED 13 failed -> GREEN 95/95 focused; full jest 169 suites / 1416 tests. userCanAccessProject gains { includeQuoteInvitations } used only by adjustments GET; project-row locks FOR NO KEY UPDATE in createProjectTask/createProjectAdjustment; SMTP provider uses {name,address}; siigo/customers uses parsePagination (default 25, max 100). Commit d84f58a.
L12. T4 done: dompurify ^3.4.17 (isomorphic-dompurify rejected: ESM jsdom breaks Jest and bloats server bundle; all 7 renderers are client components, SafeHtml renders empty on server). All listed queryFns throw on failure with error UI; wizards block Next/Create when templates fail; useDebouncedSearch hook for 7 selects; SiigoCustomersList on useQuery; URL_BACKEND_API removed; UserLoginForm no longer reads password. RED per file (plus git-archive HEAD comparison: 60 failed there) -> full jest 169/1416, tsc 0, lint 0. Commit 7e2e4a8.
L13. Inline follow-up: TaskDeliverableDialog cost correction had the S27 bug class (replace(/[^0-9.]/g)); parseCopAmount moved to app/lib/utils/cop-amount.ts and reused; FormState.submittedData.password removed. RED 2 -> GREEN 48/48. Commit e1b673c.
L14. Not changed on purpose: axios now unused in app code (dependency removal left to user); token-at-rest encryption postponed (L3); middleware page routing and /api/me still use JWT role; markAdjustmentAsCompleted returns success on foreign id (no rows updated); WizardStep3Products debounce rebuilt per render. README-RESUME.md not updated: fixes to existing behavior (CLAUDE.md policy). Native review: not run here; RDD candidate would be per work-unit commit.
