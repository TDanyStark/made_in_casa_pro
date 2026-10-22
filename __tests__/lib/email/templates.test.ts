/**
 * @jest-environment node
 */

import { taskAssigned } from "@/lib/email/templates/taskAssigned";
import { taskReady } from "@/lib/email/templates/taskReady";
import { taskReassigned } from "@/lib/email/templates/taskReassigned";
import { taskCompleted } from "@/lib/email/templates/taskCompleted";
import { quoteRequested } from "@/lib/email/templates/quoteRequested";
import { quoteReceived } from "@/lib/email/templates/quoteReceived";
import { quoteAccepted } from "@/lib/email/templates/quoteAccepted";
import { projectAdjustmentCreated } from "@/lib/email/templates/projectAdjustmentCreated";
import { projectCompleted } from "@/lib/email/templates/projectCompleted";
import { projectReadyToClose } from "@/lib/email/templates/projectReadyToClose";

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.madeincasa.com";
});

// ── Helpers ────────────────────────────────────────────────────────────────

function assertValidHtml(html: string) {
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain("<html");
  expect(html).toContain("Made in Casa");
  expect(html).toContain("</html>");
}

function assertNoUndefined(str: string) {
  expect(str).not.toContain("undefined");
  expect(str).not.toContain("[object Object]");
}

// ── taskAssigned ────────────────────────────────────────────────────────────

describe("taskAssigned template", () => {
  const ctx = {
    recipientName: "Ana García",
    assignedByName: "Daniel Amado",
    taskTitle: "Diseño de banner",
    taskType: "execution" as const,
    taskFlag: "new" as const,
    projectTitle: "Campaña Q2",
    projectId: 15,
    taskId: 3,
    dueDate: "30/04/2026",
    deliveryDays: 5,
    notes: "<p>Por favor usar paleta de colores de la marca.</p>",
  };

  it("subject includes project title and task title", () => {
    const subject = taskAssigned.subject(ctx);
    expect(subject).toContain("Campaña Q2");
    expect(subject).toContain("Diseño de banner");
  });

  it("html includes recipient name, project title and CTA link", () => {
    const html = taskAssigned.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("Ana García");
    expect(html).toContain("Campaña Q2");
    expect(html).toContain("https://app.madeincasa.com/projects/15");
  });

  it("html includes notes when provided", () => {
    const html = taskAssigned.html(ctx);
    expect(html).toContain("paleta de colores");
  });

  it("html omits notes section when notes is null", () => {
    const html = taskAssigned.html({ ...ctx, notes: null });
    expect(html).not.toContain("Notas");
  });

  it("text includes main fields", () => {
    const text = taskAssigned.text(ctx);
    expect(text).toContain("Ana García");
    expect(text).toContain("Diseño de banner");
    expect(text).toContain("Campaña Q2");
    expect(text).toContain("https://app.madeincasa.com/projects/15");
  });

  const withDetails = {
    ...ctx,
    taskDescription: "Banner 300x250 con <logo> & CTA",
    driveFolderUrl: "https://drive.google.com/drive/folders/abc123",
  };

  it("html includes escaped task description and Drive link when provided", () => {
    const html = taskAssigned.html(withDetails);
    assertNoUndefined(html);
    expect(html).toContain("Descripción");
    expect(html).toContain("Banner 300x250 con &lt;logo&gt; &amp; CTA");
    expect(html).toContain('href="https://drive.google.com/drive/folders/abc123"');
    expect(html).toContain("Abrir carpeta de Drive");
  });

  it("text includes task description and Drive link when provided", () => {
    const text = taskAssigned.text(withDetails);
    expect(text).toContain("Descripción: Banner 300x250 con <logo> & CTA");
    expect(text).toContain("Carpeta de Drive: https://drive.google.com/drive/folders/abc123");
  });

  it("omits description and Drive sections when not provided", () => {
    const html = taskAssigned.html({ ...ctx, taskDescription: null, driveFolderUrl: null });
    const text = taskAssigned.text({ ...ctx, taskDescription: null, driveFolderUrl: null });
    expect(html).not.toContain("Descripción");
    expect(html).not.toContain("Abrir carpeta de Drive");
    expect(text).not.toContain("Descripción");
    expect(text).not.toContain("Carpeta de Drive");
  });

  it("ignores a Drive link that is not http(s)", () => {
    const html = taskAssigned.html({ ...ctx, driveFolderUrl: "javascript:alert(1)" });
    const text = taskAssigned.text({ ...ctx, driveFolderUrl: "javascript:alert(1)" });
    expect(html).not.toContain("javascript:");
    expect(text).not.toContain("javascript:");
  });
});

// ── taskReady ───────────────────────────────────────────────────────────────

describe("taskReady template", () => {
  const ctx = {
    recipientName: "Ana García",
    taskTitle: "Diseño de banner",
    projectTitle: "Campaña Q2",
    projectId: 15,
    taskId: 3,
  };
  const withDetails = {
    ...ctx,
    taskDescription: "Banner 300x250 con <logo> & CTA",
    driveFolderUrl: "https://drive.google.com/drive/folders/abc123",
  };

  it("subject says the task is ready to execute, with project and task title", () => {
    expect(taskReady.subject(ctx)).toBe(
      "[Campaña Q2] Tu tarea está lista para ejecutar: Diseño de banner"
    );
  });

  it("html tells the recipient it is their turn and links to the project", () => {
    const html = taskReady.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("Ana García");
    expect(html).toContain("Diseño de banner");
    expect(html).toContain("Campaña Q2");
    expect(html).toContain("ya está lista para que la ejecutes");
    expect(html).toContain("está en tu cancha");
    expect(html).toContain('href="https://app.madeincasa.com/projects/15"');
  });

  it("html includes escaped description (pre-line) and Drive button when provided", () => {
    const html = taskReady.html(withDetails);
    assertNoUndefined(html);
    expect(html).toContain("Descripción");
    expect(html).toContain("Banner 300x250 con &lt;logo&gt; &amp; CTA");
    expect(html).not.toContain("<logo>");
    expect(html).toContain("white-space:pre-line");
    expect(html).toContain('href="https://drive.google.com/drive/folders/abc123"');
    expect(html).toContain("Abrir carpeta de Drive");
  });

  it("text version includes main fields, description and Drive link", () => {
    const text = taskReady.text(withDetails);
    assertNoUndefined(text);
    expect(text).toContain("Hola, Ana García");
    expect(text).toContain("ya está lista para que la ejecutes");
    expect(text).toContain("Diseño de banner");
    expect(text).toContain("Campaña Q2");
    expect(text).toContain("Descripción: Banner 300x250 con <logo> & CTA");
    expect(text).toContain("Ver proyecto: https://app.madeincasa.com/projects/15");
    expect(text).toContain("Carpeta de Drive: https://drive.google.com/drive/folders/abc123");
  });

  it("omits description and Drive sections when not provided", () => {
    const html = taskReady.html({ ...ctx, taskDescription: null, driveFolderUrl: null });
    const text = taskReady.text({ ...ctx, taskDescription: "   ", driveFolderUrl: null });
    expect(html).not.toContain("Descripción");
    expect(html).not.toContain("Abrir carpeta de Drive");
    expect(text).not.toContain("Descripción");
    expect(text).not.toContain("Carpeta de Drive");
  });

  it("ignores a Drive link that is not http(s)", () => {
    const html = taskReady.html({ ...ctx, driveFolderUrl: "javascript:alert(1)" });
    const text = taskReady.text({ ...ctx, driveFolderUrl: "javascript:alert(1)" });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Abrir carpeta de Drive");
    expect(text).not.toContain("javascript:");
  });
});

// ── taskReassigned ─────────────────────────────────────────────────────────

describe("taskReassigned template", () => {
  const ctx = {
    recipientName: "Ana García",
    changedByName: "Daniel Amado",
    taskTitle: "Diseño de banner",
    projectTitle: "Campaña Q2",
    projectId: 15,
    taskId: 3,
    newAssigneeName: "Luis Pérez",
  };

  it("subject tells previous assignee they are no longer responsible", () => {
    const subject = taskReassigned.subject(ctx);
    expect(subject).toContain("Ya no eres responsable");
    expect(subject).toContain("Diseño de banner");
  });

  it("html includes new assignee and stop-work instruction", () => {
    const html = taskReassigned.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("Luis Pérez");
    expect(html).toContain("No continúes trabajando");
  });

  it("text includes the new assignee when provided", () => {
    const text = taskReassigned.text(ctx);
    expect(text).toContain("Nuevo responsable: Luis Pérez");
  });
});

// ── taskCompleted ───────────────────────────────────────────────────────────

describe("taskCompleted template", () => {
  const ctx = {
    recipientName: "Daniel Amado",
    completedByName: "Ana García",
    taskTitle: "Diseño de banner",
    projectTitle: "Campaña Q2",
    projectId: 15,
    taskId: 3,
    completedAt: "24/04/2026",
    deliverableNotes: "<p>Archivo adjunto en Drive.</p>",
  };

  it("subject includes project and task title", () => {
    expect(taskCompleted.subject(ctx)).toContain("Campaña Q2");
    expect(taskCompleted.subject(ctx)).toContain("Diseño de banner");
  });

  it("html marks the task as Completada with green badge", () => {
    const html = taskCompleted.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("Completada");
    expect(html).toContain("#059669");
  });
});

// ── quoteRequested ─────────────────────────────────────────────────────────

describe("quoteRequested template", () => {
  const ctx = {
    recipientName: "Carlos Díaz",
    invitedByName: "Daniel Amado",
    taskTitle: "Fotografía de producto",
    projectTitle: "Lanzamiento XYZ",
    projectId: 7,
    taskId: 12,
    taskDescription: "5 fotos con fondo blanco",
    dueDate: "10/05/2026",
  };

  it("subject mentions the project and task", () => {
    expect(quoteRequested.subject(ctx)).toContain("Lanzamiento XYZ");
    expect(quoteRequested.subject(ctx)).toContain("Fotografía de producto");
  });

  it("html links to /my-quotes", () => {
    const html = quoteRequested.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("/my-quotes");
  });
});

// ── quoteReceived ─────────────────────────────────────────────────────────

describe("quoteReceived template", () => {
  const ctx = {
    recipientName: "Daniel Amado",
    collaboratorName: "Carlos Díaz",
    collaboratorEmail: "carlos@test.com",
    taskTitle: "Fotografía de producto",
    projectTitle: "Lanzamiento XYZ",
    projectId: 7,
    taskId: 12,
    price: 850000,
    currency: "COP",
    deliveryDays: 3,
    notes: "<p>Incluye 2 rondas de retoque.</p>",
  };

  it("subject includes collaborator and task", () => {
    const subject = quoteReceived.subject(ctx);
    expect(subject).toContain("Lanzamiento XYZ");
    expect(subject).toContain("Fotografía de producto");
  });

  it("html formats price correctly", () => {
    const html = quoteReceived.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("850");
    expect(html).toContain("COP");
  });
});

// ── quoteAccepted ─────────────────────────────────────────────────────────

describe("quoteAccepted template", () => {
  const ctx = {
    recipientName: "Carlos Díaz",
    acceptedByName: "Daniel Amado",
    taskTitle: "Fotografía de producto",
    projectTitle: "Lanzamiento XYZ",
    projectId: 7,
    taskId: 12,
    price: 850000,
    currency: "COP",
    deliveryDays: 3,
  };

  it("subject tells the collaborator their quote was accepted", () => {
    expect(quoteAccepted.subject(ctx)).toContain("aceptada");
    expect(quoteAccepted.subject(ctx)).toContain("Fotografía de producto");
  });

  it("html shows green accepted badge", () => {
    const html = quoteAccepted.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("Aceptada");
    expect(html).toContain("#059669");
  });
});

// ── projectAdjustmentCreated ──────────────────────────────────────────────

describe("projectAdjustmentCreated template", () => {
  const ctx = {
    recipientName: "Ana García",
    createdByName: "Daniel Amado",
    projectTitle: "Campaña Q2",
    projectId: 15,
    adjustmentId: 2,
    versionNumber: 2,
    notes: "<p>Ajuste menor al entregable principal.</p>",
    taskCount: 3,
  };

  it("subject includes project title and version number", () => {
    const subject = projectAdjustmentCreated.subject(ctx);
    expect(subject).toContain("Campaña Q2");
    expect(subject).toContain("v2");
  });

  it("html shows adjustment version badge in amber color", () => {
    const html = projectAdjustmentCreated.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("Ajuste v2");
    expect(html).toContain("#d97706");
  });

  it("footer note mentions the adjustment version", () => {
    const html = projectAdjustmentCreated.html(ctx);
    expect(html).toContain("versión de ajuste v2");
  });
});

// ── projectCompleted ──────────────────────────────────────────────────────

describe("projectCompleted template", () => {
  const ctx = {
    recipientName: "Todo el equipo",
    completedByName: "Daniel Amado",
    projectTitle: "Campaña Q2",
    projectId: 15,
    completedAt: "24/04/2026",
    clientName: "Acme Corp",
    brandName: "Acme",
    totalTasks: 12,
  };

  it("subject includes project title and completed word", () => {
    const subject = projectCompleted.subject(ctx);
    expect(subject).toContain("Campaña Q2");
    expect(subject).toContain("completado");
  });

  it("html shows green completed badge and celebration", () => {
    const html = projectCompleted.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("Completado");
    expect(html).toContain("#059669");
    expect(html).toContain("🎉");
  });

  it("html includes client and brand when provided", () => {
    const html = projectCompleted.html(ctx);
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Acme");
  });

  it("html omits client/brand rows when not provided", () => {
    const html = projectCompleted.html({ ...ctx, clientName: undefined, brandName: undefined });
    expect(html).not.toContain("Acme Corp");
  });
});

// ── projectReadyToClose ───────────────────────────────────────────────────

describe("projectReadyToClose template", () => {
  const ctx = {
    recipientName: "Daniel Amado",
    projectTitle: "Campaña Q2",
    projectId: 15,
    clientName: "Acme Corp",
    brandName: "Acme Brand",
  };

  it("subject announces the project is at 100% and ready to close", () => {
    expect(projectReadyToClose.subject(ctx)).toBe(
      "[Campaña Q2] Tu proyecto está al 100%, listo para cerrar"
    );
  });

  it("html greets, says all tasks are completed and links to the project", () => {
    const html = projectReadyToClose.html(ctx);
    assertValidHtml(html);
    assertNoUndefined(html);
    expect(html).toContain("Hola, Daniel Amado");
    expect(html).toContain("todas las tareas");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Acme Brand");
    expect(html).toContain("Ver proyecto");
    expect(html).toContain('href="https://app.madeincasa.com/projects/15"');
    expect(html).toContain("marcarlo como completado");
  });

  it("html omits client/brand rows when not provided and escapes the title", () => {
    const html = projectReadyToClose.html({
      ...ctx,
      projectTitle: "<b>X</b>",
      clientName: undefined,
      brandName: null,
    });
    assertNoUndefined(html);
    expect(html).not.toContain("Acme");
    expect(html).not.toContain("<b>X</b>");
    expect(html).toContain("&lt;b&gt;X&lt;/b&gt;");
  });

  it("text includes greeting, completion message and project link", () => {
    const text = projectReadyToClose.text(ctx);
    assertNoUndefined(text);
    expect(text).toContain("Hola, Daniel Amado");
    expect(text).toContain("100%");
    expect(text).toContain("Cliente: Acme Corp");
    expect(text).toContain("Ver proyecto: https://app.madeincasa.com/projects/15");
    expect(text).toContain("marcarlo como completado");
  });
});
