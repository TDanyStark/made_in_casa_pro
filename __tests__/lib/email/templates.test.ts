/**
 * @jest-environment node
 */

import { taskAssigned } from "@/lib/email/templates/taskAssigned";
import { taskCompleted } from "@/lib/email/templates/taskCompleted";
import { quoteRequested } from "@/lib/email/templates/quoteRequested";
import { quoteReceived } from "@/lib/email/templates/quoteReceived";
import { quoteAccepted } from "@/lib/email/templates/quoteAccepted";
import { projectAdjustmentCreated } from "@/lib/email/templates/projectAdjustmentCreated";
import { projectCompleted } from "@/lib/email/templates/projectCompleted";

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
