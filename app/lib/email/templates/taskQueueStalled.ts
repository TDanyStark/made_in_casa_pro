import { emailLayout, TEXT_DARK } from "./layout";
import {
  heading, subheading, paragraph,
  primaryButton, divider, muted, appUrl, escapeHtml,
} from "./components";

export interface TaskQueueStalledContext {
  recipientName: string;
  completedByName: string;
  completedTaskTitle: string;
  projectTitle: string;
  projectId: number;
  waitingTasks: { id: number; title: string }[];
}

function activateWording(count: number): string {
  return count === 1 ? "debes activarla" : "debes activarlas";
}

/**
 * Sent to the project's commercial when a completion (or a validation
 * approval) activated nothing because the next task was already completed,
 * while tasks of that version remain 'waiting' and need a manual activation.
 */
export const taskQueueStalled = {
  subject(ctx: TaskQueueStalledContext): string {
    return `[${ctx.projectTitle}] Hay tareas en espera por activar`;
  },

  html(ctx: TaskQueueStalledContext): string {
    const projectUrl = `${appUrl()}/projects/${ctx.projectId}`;
    const items = ctx.waitingTasks
      .map((t) => `<li style="margin:0 0 6px;">${escapeHtml(t.title)}</li>`)
      .join("");

    const body = [
      heading(`Hola, ${escapeHtml(ctx.recipientName)}`),
      subheading(`Hay tareas en espera por activar`),
      paragraph(
        `<strong>${escapeHtml(ctx.completedByName)}</strong> terminó la tarea <strong>${escapeHtml(ctx.completedTaskTitle)}</strong> del proyecto <strong>${escapeHtml(ctx.projectTitle)}</strong>, pero no se activó la siguiente porque ya estaba completada.`
      ),
      paragraph(`Quedaron estas tareas en espera, ${activateWording(ctx.waitingTasks.length)}:`),
      `<ul style="margin:0 0 16px;padding-left:20px;color:${TEXT_DARK};font-size:15px;line-height:1.6;">${items}</ul>`,
      primaryButton("Ver proyecto", projectUrl),
      divider(),
      muted(`La automatización solo activa la tarea inmediatamente siguiente; las demás tareas en espera deben activarse manualmente.`),
    ].join("\n");

    return emailLayout({
      previewText: `Hay tareas en espera por activar: ${escapeHtml(ctx.projectTitle)}`,
      body,
    });
  },

  text(ctx: TaskQueueStalledContext): string {
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `${ctx.completedByName} terminó la tarea "${ctx.completedTaskTitle}" del proyecto "${ctx.projectTitle}", pero no se activó la siguiente porque ya estaba completada.`,
      ``,
      `Quedaron estas tareas en espera, ${activateWording(ctx.waitingTasks.length)}:`,
      ...ctx.waitingTasks.map((t) => `- ${t.title}`),
      ``,
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
    ].join("\n");
  },
};
