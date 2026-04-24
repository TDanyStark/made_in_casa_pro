import { emailLayout } from "./layout";
import {
  heading, subheading, paragraph, infoCard,
  primaryButton, divider, muted, badge, noteBlock, appUrl,
} from "./components";

export interface QuoteRequestedContext {
  recipientName: string;
  invitedByName: string;
  taskTitle: string;
  projectTitle: string;
  projectId: number;
  taskId: number;
  taskDescription?: string | null;
  dueDate?: string | null;
  projectNotes?: string | null;
}

export const quoteRequested = {
  subject(ctx: QuoteRequestedContext): string {
    return `[${ctx.projectTitle}] Te invitaron a cotizar: ${ctx.taskTitle}`;
  },

  html(ctx: QuoteRequestedContext): string {
    const quotesUrl = `${appUrl()}/my-quotes`;

    const rows = [
      { label: "Proyecto", value: ctx.projectTitle },
      { label: "Invitado por", value: ctx.invitedByName },
      ...(ctx.dueDate ? [{ label: "Fecha límite del proyecto", value: ctx.dueDate }] : []),
    ];

    const body = [
      heading(`Hola, ${ctx.recipientName}`),
      subheading(`${ctx.invitedByName} te invitó a cotizar una tarea`),
      paragraph(`Fuiste invitado a enviar una cotización para la tarea <strong>${ctx.taskTitle}</strong> dentro del proyecto <strong>${ctx.projectTitle}</strong>.`),
      `<p style="margin:0 0 8px;font-size:18px;font-weight:700;">${ctx.taskTitle} ${badge("Pendiente cotización")}</p>`,
      ...(ctx.taskDescription
        ? [`<p style="margin:0 0 16px;color:#4b5563;font-size:14px;">${ctx.taskDescription}</p>`]
        : []),
      infoCard(rows),
      ...(ctx.projectNotes ? [divider(), noteBlock(ctx.projectNotes)] : []),
      primaryButton("Enviar cotización", quotesUrl),
      divider(),
      muted("Entra a Mis Cotizaciones para ver el detalle del proyecto y enviar tu propuesta de precio y plazo."),
    ].join("\n");

    return emailLayout({
      previewText: `Invitación a cotizar: ${ctx.taskTitle} — ${ctx.projectTitle}`,
      body,
    });
  },

  text(ctx: QuoteRequestedContext): string {
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `${ctx.invitedByName} te invitó a cotizar la tarea "${ctx.taskTitle}" en el proyecto "${ctx.projectTitle}".`,
      ``,
      ...(ctx.taskDescription ? [`Descripción: ${ctx.taskDescription}`, ``] : []),
      `Ir a Mis Cotizaciones: ${appUrl()}/my-quotes`,
    ].join("\n");
  },
};
