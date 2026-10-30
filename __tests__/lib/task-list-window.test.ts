import { getTaskListWindow, TASK_PAGE_SIZE, TASK_STACK_THRESHOLD } from "@/lib/task-list-window";

type T = { id: number; status: string };

const make = (statuses: string[]): T[] => statuses.map((status, i) => ({ id: i + 1, status }));
const ids = (tasks: T[]) => tasks.map((t) => t.id);
const closed = { showCompleted: false, extraPages: 0, showAll: false };

describe("getTaskListWindow", () => {
  it("uses a threshold of 8 and pages of 4", () => {
    expect(TASK_STACK_THRESHOLD).toBe(8);
    expect(TASK_PAGE_SIZE).toBe(4);
  });

  it("shows every task when there are 8 or fewer", () => {
    const tasks = make(["completed", "completed", "completed", "in_progress", "not_started", "not_started", "not_started", "not_started"]);
    const result = getTaskListWindow(tasks, closed);
    expect(result.stacked).toEqual([]);
    expect(ids(result.visible)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.hidden).toEqual([]);
  });

  it("stacks leading completed tasks and shows the active task plus the next 4", () => {
    const tasks = make([...Array(12).fill("completed"), "in_progress", ...Array(87).fill("not_started")]);
    const result = getTaskListWindow(tasks, closed);
    expect(result.stacked).toHaveLength(12);
    expect(ids(result.visible)).toEqual([13, 14, 15, 16, 17]);
    expect(result.hidden).toHaveLength(83);
  });

  it("keeps a deep attention task visible even beyond the first page", () => {
    const tasks = make([...Array(9).fill("not_started"), "blocked", "not_started", "not_started"]);
    const result = getTaskListWindow(tasks, closed);
    expect(result.stacked).toEqual([]);
    expect(ids(result.visible)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.hidden).toEqual([]);
  });

  it("loads 4 more per extra page and everything with showAll", () => {
    const tasks = make(Array(20).fill("not_started"));
    expect(getTaskListWindow(tasks, closed).visible).toHaveLength(4);
    expect(getTaskListWindow(tasks, { ...closed, extraPages: 2 }).visible).toHaveLength(12);
    const all = getTaskListWindow(tasks, { ...closed, showAll: true });
    expect(all.visible).toHaveLength(20);
    expect(all.hidden).toEqual([]);
  });

  it("unstacks completed tasks when showCompleted is true, keeping the order contiguous", () => {
    const tasks = make([...Array(10).fill("completed"), ...Array(10).fill("not_started")]);
    const result = getTaskListWindow(tasks, { ...closed, showCompleted: true });
    expect(result.stacked).toEqual([]);
    expect(ids(result.visible)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(ids([...result.stacked, ...result.visible, ...result.hidden])).toEqual(ids(tasks));
  });
});
