import { emailLayout } from "./layout";
import {
  heading, subheading, paragraph, infoCard,
  primaryButton, divider, muted, badge, noteBlock, appUrl,
} from "./components";

export interface TaskAssignedContext {
  recipientName: string;
  assignedByName: string;
  taskTitle: string;
  taskType: "execution" | "validation";
  taskFlag: "new" | "correction" | "adjustment";
  projectTitle: string;
  projectId: number;
  taskId: number;
  dueDate?: string | null;
  deliveryDays?: number | null;
  notes?: string | null;
}

const FLAG_LABELS: Record<string, string> = {
  new: "Nueva",
  correction: "Corrección",
  adjustment: "Ajuste",
};

const TYPE_LABELS: Record<string, string> = {
  execution: "Ejecución",
  validation: "Validación",
};

export const taskAssigned = {
  subject(ctx: TaskAssignedContext): string {
    return `[${ctx.projectTitle}] Se te asignó una tarea: ${ctx.taskTitle}`;
  },

  html(ctx: TaskAssignedContext): string {
    const projectUrl = `${appUrl()}/projects/${ctx.projectId}`;

    const rows = [
      { label: "Proyecto", value: ctx.projectTitle },
      { label: "Tipo", value: TYPE_LABELS[ctx.taskType] ?? ctx.taskType },
      { label: "Bandera", value: FLAG_LABELS[ctx.taskFlag] ?? ctx.taskFlag },
      ...(ctx.dueDate ? [{ label: "Fecha límite", value: ctx.dueDate }] : []),
      ...(ctx.deliveryDays != null
        ? [{ label: "Días de entrega estimados", value: `${ctx.deliveryDays} días` }]
        : []),
      { label: "Asignado por", value: ctx.assignedByName },
    ];

    const body = [
      heading(`Hola, ${ctx.recipientName}`),
      subheading(`${ctx.assignedByName} te asignó una nueva tarea`),
      paragraph(`Tienes una nueva tarea pendiente en el proyecto <strong>${ctx.projectTitle}</strong>.`),
      `<p style="margin:0 0 16px;font-size:20px;font-weight:700;">${ctx.taskTitle} ${badge(FLAG_LABELS[ctx.taskFlag] ?? ctx.taskFlag)}</p>`,
      infoCard(rows),
      ...(ctx.notes ? [divider(), noteBlock(ctx.notes)] : []),
      primaryButton("Ver proyecto", projectUrl),
      divider(),
      muted(`Entra a Made in Casa Pro para gestionar tu tarea y marcarla como completada cuando termines.`),
    ].join("\n");

    return emailLayout({
      previewText: `Tarea asignada: ${ctx.taskTitle} — ${ctx.projectTitle}`,
      body,
    });
  },

  text(ctx: TaskAssignedContext): string {
    return [
      `Hola, ${ctx.recipientName}`,
      ``,
      `${ctx.assignedByName} te asignó la tarea "${ctx.taskTitle}" en el proyecto "${ctx.projectTitle}".`,
      ``,
      `Tipo: ${TYPE_LABELS[ctx.taskType] ?? ctx.taskType}`,
      `Bandera: ${FLAG_LABELS[ctx.taskFlag] ?? ctx.taskFlag}`,
      ...(ctx.dueDate ? [`Fecha límite: ${ctx.dueDate}`] : []),
      ...(ctx.deliveryDays != null ? [`Días estimados: ${ctx.deliveryDays}`] : []),
      ``,
      `Ver proyecto: ${appUrl()}/projects/${ctx.projectId}`,
    ].join("\n");
  },
};
