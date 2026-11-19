import { toCollaboratorQuoteView } from "@/lib/utils/collaborator-quote-view";
import type { ProjectDetailType, ProjectTaskType } from "@/lib/definitions";

const project = { id: 15, title: "Proyecto", sale_price: 5_000_000 } as unknown as ProjectDetailType;

const tasks = [
  { id: 101, title: "Propia", assigned_user_id: 22, completion_cost: 300_000 },
  { id: 202, title: "Ajena", assigned_user_id: 33, completion_cost: 450_000 },
  { id: 303, title: "Sin asignar", assigned_user_id: null, completion_cost: null },
] as unknown as ProjectTaskType[];

describe("toCollaboratorQuoteView", () => {
  it("removes the project sale price", () => {
    const view = toCollaboratorQuoteView(project, tasks, 22);
    expect(view.project).not.toHaveProperty("sale_price");
    expect(view.project).toEqual({ id: 15, title: "Proyecto" });
  });

  it("keeps the viewer's own task cost and hides every other task cost", () => {
    const view = toCollaboratorQuoteView(project, tasks, 22);
    expect(view.tasks).toEqual([
      { id: 101, title: "Propia", assigned_user_id: 22, completion_cost: 300_000 },
      { id: 202, title: "Ajena", assigned_user_id: 33, completion_cost: null },
      { id: 303, title: "Sin asignar", assigned_user_id: null, completion_cost: null },
    ]);
  });

  it("hides every task cost when there is no viewer id", () => {
    const view = toCollaboratorQuoteView(project, tasks, undefined);
    expect(view.tasks.map((t) => t.completion_cost)).toEqual([null, null, null]);
  });

  it("matches the owner when pg returns ids as strings", () => {
    const pgTasks = [
      { id: 1, assigned_user_id: "22", completion_cost: "100.00" },
      { id: 2, assigned_user_id: "33", completion_cost: "5" },
    ] as unknown as ProjectTaskType[];
    expect(toCollaboratorQuoteView(project, pgTasks, 22).tasks.map((t) => t.completion_cost)).toEqual(["100.00", null]);
    expect(
      toCollaboratorQuoteView(project, pgTasks, "22" as unknown as number).tasks.map((t) => t.completion_cost)
    ).toEqual(["100.00", null]);
  });

  it("drops sale_price from the serialized payload", () => {
    const view = toCollaboratorQuoteView(project, tasks, 22);
    expect(JSON.parse(JSON.stringify(view.project))).not.toHaveProperty("sale_price");
  });

  it("does not mutate its inputs", () => {
    toCollaboratorQuoteView(project, tasks, 22);
    expect(project.sale_price).toBe(5_000_000);
    expect(tasks[1].completion_cost).toBe(450_000);
  });
});
