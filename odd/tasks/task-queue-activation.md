# Task queue activation with manual parallel tasks
Automation activates at most one next task; manual parallel activations survive; the commercial is told when the queue stalls.
Branch: main (uncommitted; working tree already holds unrelated uncommitted work).

## Specs
- S1 Completing (or approving a validation) looks only at the task immediately after it. That task is activated only when it is "En espera" and every task before it is completed. User: "no se active la siguiente si no solo hasta que todas las anteriores ya esten completadas ... la automatizacion solo deberia poder activar automaticamente 1 la que sigue".
- S2 If the next task is already active ("Sin iniciar", en progreso, pausada, bloqueada) nothing changes: no new "Asignada" date, no extra history entry, no repeated task.ready email. User: "si esta en sin iniciar se supone ya esta activa para que un miembro la tome".
- S3 If the next task is already completed, nothing is activated; when tasks remain "En espera" in that version, the project's commercial gets an email. User: "decirle algo como un colaborador ha terminado la tarea pero no se ha activado la siguiente porqyue ya estaba completada, pero quedaron estas en espera debes activarla". Example: 5 tasks; 1-2 completed, 3 sin iniciar, 4 completed, 5 en espera → completing 3 activates nothing, the commercial is emailed about task 5.
- S4 Reordering or deleting a task no longer sends manually activated tasks back to "En espera". It still activates the first pending task when it is waiting (so a reordered queue never stalls), activating at most that one.
- S5 A waiting task has a quick "Activar" button, usable only by comercial, admin and directivo (answer: "Comercial, admin y directivo"). It moves the task to "Sin iniciar" and emails its assignee.

## Tasks
- T1 S1-S2 completeTask + complete/validate routes — inline — DONE (uncommitted). completeTask returns `nextActivated`/`nextCompleted`; validateTask returns `targetActivated`/`nextCompleted`; routes send task.ready only when activated.
  T2 design: new event `task.queue_stalled` (input: actorUserId, projectId, taskId = the task just completed). Complete and validate(approve) routes dispatch it when `nextCompleted` is true. The engine sends one email to `getProjectCommercial(projectId)` from the actor, listing the 'waiting' tasks of the completed task's version (getTasksByProject(projectId, task.adjustment_id)); when there are none or no commercial, it sends nothing. Store the waiting task ids/titles in event metadata so the retry route (`app/api/notification-deliveries/[id]/retry/route.ts`) can rebuild the email. Add a template under `app/lib/email/templates/` following projectReadyToClose.ts, and labels in EmailHistoryTable.tsx / FailedDeliveriesPanel.tsx ("Cola detenida (aviso comercial)").
- T2 S3 new notification event to the commercial — worker mvua5h69-1-nkxs — DONE (uncommitted): task.queue_stalled, taskQueueStalled template, retry case, labels
- T3 S4 ensureNextPendingTaskActive — inline — DONE (uncommitted)
- T4 S5 POST /tasks/[tid]/activate + button — inline — DONE (uncommitted): activateWaitingTask(), TASK_ACTIVATE_ROLES, ProjectTasksTab 'Activar' button, README queue section

## Log
- L1 "ven esta pasando algo de la logica que debemos resolver, actualmente me piden que les active tareas manualmente porque claro solo puede haber una activa esto esta bien por defecto pero uno puede cambiar el estado a otra tarea a sin iniciar y estarian 2 activas al tiempo, eso me lo piden y funciona esta bien, pero quiero saber que pasa cuando se complete una tarea? y cuando se complete la otra? deberia activar la siguiente en el flujo, pero claro, aqui hay algo y es que como se activaron 2 al tiempo a sin iniciar entonces si se comletan las 2 solo debe activar la siguiente no deberia activar las 2 siguientes"
- L2 Follow-up: S2/S3/S5 quotes; "tambien cuando este en espera debe haber un boton para que solo el comercial pueda activarla rapidamente".
- L3 Decisions: button roles = comercial, admin, directivo; notice channel = email like other notices.
- L4 Decision (agent, reported to user): S4 keeps promoting the first pending task on reorder/delete; only promoting when nothing is active would let a reordered waiting task stall forever with no notice.
- L5 Evidence: full jest 192 suites / 1614 tests pass; tsc clean; eslint errors only in 4 untouched pre-existing test files.
