import { emailLayout } from "./layout";
import {
  heading, subheading, paragraph, infoCard,
  primaryButton, secondaryButton, divider, muted, appUrl, escapeHtml, safeDriveUrl,
} from "./components";

export interface TaskReadyContext {
  recipientName: string;
  taskTitle: string;
  projectTitle: string;
  projectId: number;
  taskId: number;
  taskDescription?: string | null;
  driveFolderUrl?: string | null;
}

/**
 * Sent when a task with an assignee becomes 'not_started' (created active or
 * activated from 'waiting'/'blocked'): it is now the assignee's turn to execute it.
 */
export const taskReady = {
  subject(ctx: TaskReadyContext): string {
    return `[${ctx.projectTitle}] Tu tarea está lista para ejecutar: ${ctx.taskTitle}`;
  },

  html(ctx: TaskReadyContext): string {
    const projectUrl = `${appUrl()}/projects/${ctx.projectId}`;
    const description = ctx.taskDescription?.trim();
    const driveUrl = safeDriveUrl(ctx.driveFolderUrl);

    const body = [
      heading(`Hola, ${escapeHtml(ctx.recipientName)}`),
      subheading(`Tu tarea ya está lista para que la ejecutes`),
      paragraph(
        `Es tu turno: la tarea está en tu cancha y ya puedes empezar a trabajar en ella en el proyecto <strong>${escapeHtml(ctx.projectTitle)}</strong>.`
      ),
      `<p style="margin:0 0 16px;font-size:20px;font-weight:700;">${escapeHtml(ctx.taskTitle)}</p>`,
      ...(description
        ? [
            `<p style="margin:0 0 6px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Descripción</p>`,
            `<p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(description)}</p>`,
          ]
        : []),
      infoCard([
        { label: "Proyecto", value: ctx.projectTitle },
        { label: "Tarea", value: ctx.taskTitle },
      ]),
      primaryButton("Ver proyecto", projectUrl),
      ...(driveUrl ? [secondaryButton("Abrir carpeta de Drive", escapeHtml(driveUrl))] : []),
      divider(),
      muted(`Entra a Made in Casa Pro para iniciar la tarea y marcarla como completada cuando termines.`),
    ].join("\n");

    return emailLayout({
      previewText: `Tu tarea está lista para ejecutar: ${ctx.taskTitle} — ${ctx.projectTitle}`,
      body,
    });
  },

  text(ctx: TaskReadyContext): string {
    const description = ctx.taskDescription?.trim();
    const driveUrl = safeDriveUrl(ctx.driveFolderUrl);
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `Tu tarea "${ctx.taskTitle}" del proyecto "${ctx.projectTitle}" ya está lista para que la ejecutes: está en tu cancha.`,
      ...(description ? [``, `Descripción: ${description}`] : []),
      ``,
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
      ...(driveUrl ? [`Carpeta de Drive: ${driveUrl}`] : []),
    ].join("\n");
  },
};
