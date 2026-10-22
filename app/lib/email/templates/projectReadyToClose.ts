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
 * project's progress reaches 100%: all tasks are done and it can be closed
 * with "Marcar como completado".
 */
export const projectReadyToClose = {
  subject(ctx: ProjectReadyToCloseContext): string {
    return `[${ctx.projectTitle}] Tu proyecto está al 100%, listo para cerrar`;
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
      subheading(`Tu proyecto está al 100%, listo para cerrar`),
      paragraph(
        `Se completaron todas las tareas del proyecto <strong>${escapeHtml(ctx.projectTitle)}</strong>.`
      ),
      infoCard(rows),
      primaryButton("Ver proyecto", projectUrl),
      divider(),
      muted(`Revisa el proyecto y, si todo está en orden, entra a Made in Casa Pro para marcarlo como completado.`),
    ].join("\n");

    return emailLayout({
      previewText: `Tu proyecto está al 100%, listo para cerrar: ${escapeHtml(ctx.projectTitle)}`,
      body,
    });
  },

  text(ctx: ProjectReadyToCloseContext): string {
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `Tu proyecto "${ctx.projectTitle}" está al 100%: se completaron todas las tareas y está listo para cerrar.`,
      ...(ctx.clientName ? [`Cliente: ${ctx.clientName}`] : []),
      ...(ctx.brandName ? [`Marca: ${ctx.brandName}`] : []),
      ``,
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
      ``,
      `Revisa el proyecto y, si todo está en orden, entra a Made in Casa Pro para marcarlo como completado.`,
    ].join("\n");
  },
};
