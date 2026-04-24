import { emailLayout } from "./layout";
import {
  heading, subheading, paragraph, infoCard,
  primaryButton, divider, muted, badge, noteBlock, appUrl,
} from "./components";

export interface TaskCompletedContext {
  recipientName: string;
  completedByName: string;
  taskTitle: string;
  projectTitle: string;
  projectId: number;
  taskId: number;
  completedAt: string;
  deliverableNotes?: string | null;
}

export const taskCompleted = {
  subject(ctx: TaskCompletedContext): string {
    return `[${ctx.projectTitle}] Tarea completada: ${ctx.taskTitle}`;
  },

  html(ctx: TaskCompletedContext): string {
    const projectUrl = `${appUrl()}/projects/${ctx.projectId}`;

    const rows = [
      { label: "Proyecto", value: ctx.projectTitle },
      { label: "Completada por", value: ctx.completedByName },
      { label: "Fecha", value: ctx.completedAt },
    ];

    const body = [
      heading(`Hola, ${ctx.recipientName}`),
      subheading("Una tarea fue marcada como completada"),
      paragraph(`<strong>${ctx.completedByName}</strong> completó la tarea <strong>${ctx.taskTitle}</strong> en el proyecto <strong>${ctx.projectTitle}</strong>.`),
      `<p style="margin:0 0 16px;font-size:18px;font-weight:700;">${ctx.taskTitle} ${badge("Completada", "#059669")}</p>`,
      infoCard(rows),
      ...(ctx.deliverableNotes ? [divider(), noteBlock(ctx.deliverableNotes)] : []),
      primaryButton("Ver proyecto", projectUrl),
      divider(),
      muted("Revisa el proyecto para ver el estado actualizado de las tareas."),
    ].join("\n");

    return emailLayout({
      previewText: `Tarea completada: ${ctx.taskTitle} — ${ctx.projectTitle}`,
      body,
    });
  },

  text(ctx: TaskCompletedContext): string {
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `${ctx.completedByName} completó la tarea "${ctx.taskTitle}" en el proyecto "${ctx.projectTitle}".`,
      ``,
      `Fecha: ${ctx.completedAt}`,
      ``,
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
    ].join("\n");
  },
};
