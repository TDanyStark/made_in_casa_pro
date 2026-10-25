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
T1 | S1-S10 | writer A (background) | pending | -
T2 | S11-S22 | writer B (background) | pending | -
T3 | S23-S25 | writer C (background) | pending | -
T4 | S26-S31 | writer D (background) | pending | -
T5 | all | independent verify (high-risk items 1,2,4) | pending | -

## Log
L1. User: "quiero que hagas una revision de posibles bugs de mi app"
L2. User: "necesito que arregles todos esos bugs" (referring to the consolidated report in this session).
L3. User decisions: COLABORADOR PATCH -> "Nada por PATCH (recomendado)"; Gmail token encryption -> "Posponer"; session -> "Releer usuario en cada API (recomendado)"; progress_minutes -> "No lo sé, revisa la UI".
L4. Evidence: TaskCompleteDialog.tsx:73 seeds accumulatedMinutes from task.progress_minutes and :176 submits it, so progress_minutes on complete is the total.
