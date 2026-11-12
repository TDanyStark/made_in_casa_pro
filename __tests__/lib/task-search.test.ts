import { taskMatchesSearch } from "@/lib/task-search";

const task = { title: "Diseño de Logo", assigned_user_name: "María Pérez" };

describe("taskMatchesSearch", () => {
  it("matches every task when the query is empty or blank", () => {
    expect(taskMatchesSearch(task, "")).toBe(true);
    expect(taskMatchesSearch(task, "   ")).toBe(true);
  });

  it("matches by task title, ignoring case and accents", () => {
    expect(taskMatchesSearch(task, "diseno")).toBe(true);
    expect(taskMatchesSearch(task, "LOGO")).toBe(true);
  });

  it("matches by collaborator name, ignoring case and accents", () => {
    expect(taskMatchesSearch(task, "maria")).toBe(true);
    expect(taskMatchesSearch(task, "  pérez ")).toBe(true);
  });

  it("does not match unrelated text or tasks without assignee", () => {
    expect(taskMatchesSearch(task, "video")).toBe(false);
    expect(taskMatchesSearch({ title: "Video", assigned_user_name: null }, "maria")).toBe(false);
  });
});
