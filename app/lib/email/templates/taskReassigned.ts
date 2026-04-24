import { emailLayout } from "./layout";
import {
  heading,
  subheading,
  paragraph,
  infoCard,
  primaryButton,
  divider,
  muted,
  badge,
  appUrl,
} from "./components";

export interface TaskReassignedContext {
  recipientName: string;
  changedByName: string;
  taskTitle: string;
  projectTitle: string;
  projectId: number;
  taskId: number;
  newAssigneeName?: string | null;
}

export const taskReassigned = {
  subject(ctx: TaskReassignedContext): string {
    return `[${ctx.projectTitle}] Ya no eres responsable de: ${ctx.taskTitle}`;
  },

  html(ctx: TaskReassignedContext): string {
    const projectUrl = `${appUrl()}/projects/${ctx.projectId}`;
    const rows = [
      { label: "Proyecto", value: ctx.projectTitle },
      { label: "Tarea", value: ctx.taskTitle },
      { label: "Cambio realizado por", value: ctx.changedByName },
      ...(ctx.newAssigneeName ? [{ label: "Nuevo responsable", value: ctx.newAssigneeName }] : []),
    ];

    const body = [
      heading(`Hola, ${ctx.recipientName}`),
      subheading("Esta tarea fue reasignada"),
      paragraph(`Ya no eres responsable de la tarea <strong>${ctx.taskTitle}</strong> en el proyecto <strong>${ctx.projectTitle}</strong>.`),
      `<p style="margin:0 0 16px;font-size:18px;font-weight:700;">${ctx.taskTitle} ${badge("Reasignada", "#dc2626")}</p>`,
      infoCard(rows),
      primaryButton("Ver proyecto", projectUrl),
      divider(),
      muted("No continúes trabajando en esta tarea salvo que el equipo te lo indique nuevamente."),
    ].join("\n");

    return emailLayout({
      previewText: `Ya no eres responsable de ${ctx.taskTitle} — ${ctx.projectTitle}`,
      body,
    });
  },

  text(ctx: TaskReassignedContext): string {
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `Ya no eres responsable de la tarea "${ctx.taskTitle}" en el proyecto "${ctx.projectTitle}".`,
      ctx.newAssigneeName ? `Nuevo responsable: ${ctx.newAssigneeName}` : null,
      `Cambio realizado por: ${ctx.changedByName}`,
      ``,
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
    ].filter(Boolean).join("\n");
  },
};
