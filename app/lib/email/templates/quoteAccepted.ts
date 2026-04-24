import { emailLayout } from "./layout";
import {
  heading, subheading, paragraph, infoCard,
  primaryButton, divider, muted, badge, appUrl,
} from "./components";

export interface QuoteAcceptedContext {
  recipientName: string;
  acceptedByName: string;
  taskTitle: string;
  projectTitle: string;
  projectId: number;
  taskId: number;
  price: number;
  currency?: string;
  deliveryDays: number;
  dueDate?: string | null;
}

export const quoteAccepted = {
  subject(ctx: QuoteAcceptedContext): string {
    return `[${ctx.projectTitle}] Tu cotización fue aceptada: ${ctx.taskTitle}`;
  },

  html(ctx: QuoteAcceptedContext): string {
    const quotesUrl = `${appUrl()}/my-quotes`;
    const currency = ctx.currency ?? "COP";
    const formattedPrice = ctx.price.toLocaleString("es-CO");

    const rows = [
      { label: "Proyecto", value: ctx.projectTitle },
      { label: "Aceptado por", value: ctx.acceptedByName },
      { label: "Precio acordado", value: `${currency} ${formattedPrice}` },
      { label: "Días de entrega", value: `${ctx.deliveryDays} días` },
      ...(ctx.dueDate ? [{ label: "Fecha límite", value: ctx.dueDate }] : []),
    ];

    const body = [
      heading(`¡Felicitaciones, ${ctx.recipientName}!`),
      subheading("Tu cotización fue aceptada"),
      paragraph(`<strong>${ctx.acceptedByName}</strong> aceptó tu cotización para la tarea <strong>${ctx.taskTitle}</strong> en el proyecto <strong>${ctx.projectTitle}</strong>.`),
      `<p style="margin:0 0 16px;font-size:24px;font-weight:800;color:#059669;">${currency} ${formattedPrice} ${badge("Aceptada", "#059669")}</p>`,
      infoCard(rows),
      primaryButton("Ver mis tareas asignadas", quotesUrl),
      divider(),
      muted("La tarea ya está asignada a tu nombre. Entra a Made in Casa Pro para comenzar el trabajo y marcar tu progreso."),
    ].join("\n");

    return emailLayout({
      previewText: `Tu cotización fue aceptada: ${ctx.taskTitle} — ${ctx.projectTitle}`,
      body,
    });
  },

  text(ctx: QuoteAcceptedContext): string {
    const currency = ctx.currency ?? "COP";
    return [
      `¡Felicitaciones, ${ctx.recipientName}!`,
      ``,
      `${ctx.acceptedByName} aceptó tu cotización para la tarea "${ctx.taskTitle}" en "${ctx.projectTitle}".`,
      ``,
      `Precio acordado: ${currency} ${ctx.price}`,
      `Días de entrega: ${ctx.deliveryDays}`,
      ``,
      `Ver mis cotizaciones: ${appUrl()}/my-quotes`,
    ].join("\n");
  },
};
