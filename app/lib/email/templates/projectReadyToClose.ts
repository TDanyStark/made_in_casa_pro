import { emailLayout } from "./layout";
import {
  heading, subheading, paragraph, infoCard,
  primaryButton, divider, muted, appUrl, escapeHtml,
} from "./components";

export interface ProjectReadyToCloseContext {
  recipientName: string;
  projectTitle: string;
  projectId: number;
  clientName?: string | null;
  brandName?: string | null;
}

/**
 * Sent to the project's commercial (projects.created_by) every time the
 * project's progress reaches 100%: all tasks are done and it has been completed automatically.
 * The historical event/template identifier is retained for delivery retries.
 */
export const projectReadyToClose = {
  subject(ctx: ProjectReadyToCloseContext): string {
    return `[${ctx.projectTitle}] Tu proyecto se completó al 100%`;
  },

  html(ctx: ProjectReadyToCloseContext): string {
    const projectUrl = `${appUrl()}/projects/${ctx.projectId}`;

    const rows = [
      { label: "Proyecto", value: ctx.projectTitle },
      ...(ctx.clientName ? [{ label: "Cliente", value: ctx.clientName }] : []),
      ...(ctx.brandName ? [{ label: "Marca", value: ctx.brandName }] : []),
      { label: "Progreso", value: "100%" },
    ];

    const body = [
      heading(`Hola, ${escapeHtml(ctx.recipientName)}`),
      subheading(`Tu proyecto se completó al 100%`),
      paragraph(
        `Se completaron todas las tareas del proyecto <strong>${escapeHtml(ctx.projectTitle)}</strong>.`
      ),
      infoCard(rows),
      primaryButton("Ver proyecto", projectUrl),
      divider(),
      muted(`El proyecto se marcó automáticamente como completado. Puedes agregar tareas en la última versión para reabrirlo o crear un ajuste.`),
    ].join("\n");

    return emailLayout({
      previewText: `Tu proyecto se completó al 100%: ${escapeHtml(ctx.projectTitle)}`,
      body,
    });
  },

  text(ctx: ProjectReadyToCloseContext): string {
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `Tu proyecto "${ctx.projectTitle}" está al 100%: se completaron todas las tareas.`,
      ...(ctx.clientName ? [`Cliente: ${ctx.clientName}`] : []),
      ...(ctx.brandName ? [`Marca: ${ctx.brandName}`] : []),
      ``,
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
      ``,
      `El proyecto se marcó automáticamente como completado. Puedes agregar tareas en la última versión para reabrirlo o crear un ajuste.`,
    ].join("\n");
  },
};
