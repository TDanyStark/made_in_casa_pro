import { emailLayout } from "./layout";
import {
  heading, subheading, paragraph, infoCard,
  primaryButton, divider, muted, badge, noteBlock, appUrl,
} from "./components";

export interface QuoteReceivedContext {
  recipientName: string;
  collaboratorName: string;
  collaboratorEmail: string;
  taskTitle: string;
  projectTitle: string;
  projectId: number;
  taskId: number;
  price: number;
  currency?: string;
  deliveryDays: number;
  notes?: string | null;
}

export const quoteReceived = {
  subject(ctx: QuoteReceivedContext): string {
    return `[${ctx.projectTitle}] Nueva cotización recibida: ${ctx.taskTitle}`;
  },

  html(ctx: QuoteReceivedContext): string {
    const projectUrl = `${appUrl()}/projects/${ctx.projectId}`;
    const currency = ctx.currency ?? "COP";
    const formattedPrice = ctx.price.toLocaleString("es-CO");

    const rows = [
      { label: "Colaborador", value: `${ctx.collaboratorName} (${ctx.collaboratorEmail})` },
      { label: "Proyecto", value: ctx.projectTitle },
      { label: "Tarea", value: ctx.taskTitle },
      { label: "Precio cotizado", value: `${currency} ${formattedPrice}` },
      { label: "Días de entrega", value: `${ctx.deliveryDays} días` },
    ];

    const body = [
      heading(`Hola, ${ctx.recipientName}`),
      subheading("Recibiste una nueva cotización"),
      paragraph(`<strong>${ctx.collaboratorName}</strong> envió una cotización para la tarea <strong>${ctx.taskTitle}</strong> en el proyecto <strong>${ctx.projectTitle}</strong>.`),
      `<p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#7c3aed;">${currency} ${formattedPrice} ${badge(`${ctx.deliveryDays} días`, "#0891b2")}</p>`,
      infoCard(rows),
      ...(ctx.notes ? [divider(), noteBlock(ctx.notes)] : []),
      primaryButton("Revisar y aceptar", projectUrl),
      divider(),
      muted("Entra al proyecto para revisar la cotización y aceptarla o rechazarla."),
    ].join("\n");

    return emailLayout({
      previewText: `Nueva cotización de ${ctx.collaboratorName}: ${ctx.taskTitle}`,
      body,
    });
  },

  text(ctx: QuoteReceivedContext): string {
    const currency = ctx.currency ?? "COP";
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `${ctx.collaboratorName} cotizó la tarea "${ctx.taskTitle}" en "${ctx.projectTitle}".`,
      ``,
      `Precio: ${currency} ${ctx.price}`,
      `Días de entrega: ${ctx.deliveryDays}`,
      ``,
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
    ].join("\n");
  },
};
