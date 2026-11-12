import { emailLayout } from "./layout";
import {
  heading, subheading, paragraph, infoCard,
  primaryButton, divider, muted, badge, noteBlock, appUrl,
} from "./components";

export interface ProjectAdjustmentCreatedContext {
  recipientName: string;
  createdByName: string;
  projectTitle: string;
  projectId: number;
  adjustmentId: number;
  versionNumber: number;
  notes?: string | null;
  taskCount?: number;
}

export const projectAdjustmentCreated = {
  subject(ctx: ProjectAdjustmentCreatedContext): string {
    return `[${ctx.projectTitle}] Nueva versión: v${ctx.versionNumber}`;
  },

  html(ctx: ProjectAdjustmentCreatedContext): string {
    const projectUrl = `${appUrl()}/projects/${ctx.projectId}`;

    const rows = [
      { label: "Proyecto", value: ctx.projectTitle },
      { label: "Versión", value: `v${ctx.versionNumber}` },
      { label: "Creado por", value: ctx.createdByName },
      ...(ctx.taskCount != null ? [{ label: "Tareas en esta versión", value: String(ctx.taskCount) }] : []),
    ];

    const body = [
      heading(`Hola, ${ctx.recipientName}`),
      subheading("Se creó una nueva versión en el proyecto"),
      paragraph(`<strong>${ctx.createdByName}</strong> creó una nueva versión en <strong>${ctx.projectTitle}</strong>. Este hilo corresponde a la versión <strong>v${ctx.versionNumber}</strong>.`),
      `<p style="margin:0 0 16px;font-size:18px;font-weight:700;">${ctx.projectTitle} ${badge(`Versión v${ctx.versionNumber}`, "#d97706")}</p>`,
      infoCard(rows),
      ...(ctx.notes ? [divider(), noteBlock(ctx.notes)] : []),
      primaryButton("Ver versión en el proyecto", projectUrl),
      divider(),
      muted("Las respuestas a este correo quedarán en el hilo de esta versión."),
    ].join("\n");

    return emailLayout({
      previewText: `Nueva versión v${ctx.versionNumber}: ${ctx.projectTitle}`,
      body,
      footerNote: `Este es el inicio del hilo de la versión v${ctx.versionNumber} del proyecto ${ctx.projectTitle}.`,
    });
  },

  text(ctx: ProjectAdjustmentCreatedContext): string {
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `${ctx.createdByName} creó la versión v${ctx.versionNumber} en el proyecto "${ctx.projectTitle}".`,
      ``,
      ...(ctx.taskCount != null ? [`Tareas en esta versión: ${ctx.taskCount}`, ``] : []),
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
    ].join("\n");
  },
};
