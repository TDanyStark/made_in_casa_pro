import { emailLayout } from "./layout";
import {
  heading, subheading, paragraph, infoCard,
  primaryButton, divider, muted, badge, appUrl,
} from "./components";

export interface ProjectCompletedContext {
  recipientName: string;
  completedByName: string;
  projectTitle: string;
  projectId: number;
  completedAt: string;
  clientName?: string;
  brandName?: string;
  totalTasks?: number;
}

export const projectCompleted = {
  subject(ctx: ProjectCompletedContext): string {
    return `[${ctx.projectTitle}] Proyecto completado`;
  },

  html(ctx: ProjectCompletedContext): string {
    const projectUrl = `${appUrl()}/projects/${ctx.projectId}`;

    const rows = [
      { label: "Proyecto", value: ctx.projectTitle },
      ...(ctx.clientName ? [{ label: "Cliente", value: ctx.clientName }] : []),
      ...(ctx.brandName ? [{ label: "Marca", value: ctx.brandName }] : []),
      { label: "Completado por", value: ctx.completedByName },
      { label: "Fecha", value: ctx.completedAt },
      ...(ctx.totalTasks != null ? [{ label: "Total de tareas", value: String(ctx.totalTasks) }] : []),
    ];

    const body = [
      heading(`¡Proyecto completado! 🎉`),
      subheading(`Hola, ${ctx.recipientName}`),
      paragraph(`El proyecto <strong>${ctx.projectTitle}</strong> fue marcado como completado por <strong>${ctx.completedByName}</strong>.`),
      `<p style="margin:0 0 16px;font-size:20px;font-weight:700;">${ctx.projectTitle} ${badge("Completado", "#059669")}</p>`,
      infoCard(rows),
      primaryButton("Ver proyecto", projectUrl),
      divider(),
      muted("Gracias a todos los que participaron en este proyecto."),
    ].join("\n");

    return emailLayout({
      previewText: `Proyecto completado: ${ctx.projectTitle}`,
      body,
    });
  },

  text(ctx: ProjectCompletedContext): string {
    return [
      `¡Proyecto completado!`,
      ``,
      `Hola, ${ctx.recipientName}`,
      ``,
      `El proyecto "${ctx.projectTitle}" fue marcado como completado por ${ctx.completedByName}.`,
      ``,
      `Fecha: ${ctx.completedAt}`,
      ``,
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
    ].join("\n");
  },
};
