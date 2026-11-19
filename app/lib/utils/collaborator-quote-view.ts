import type { ProjectDetailType, ProjectTaskType } from "@/lib/definitions";

export type CollaboratorQuoteProject = Omit<ProjectDetailType, "sale_price">;

type CostedTask = { assigned_user_id?: number | null; completion_cost?: number | null };

/**
 * Task costs are privileged: a viewer only keeps the cost of a task assigned
 * to them; every other task cost is hidden.
 */
export function hideOtherTaskCost<T extends CostedTask>(task: T, viewerId: number | null | undefined): T {
  const ownerId = viewerId == null ? null : Number(viewerId);
  const isOwn =
    ownerId != null && task.assigned_user_id != null && Number(task.assigned_user_id) === ownerId;
  return isOwn ? task : { ...task, completion_cost: null };
}

/**
 * Strips privileged financial data before a project reaches a collaborator
 * invited to quote: the project sale price is removed, and every task cost
 * except the viewer's own is hidden.
 */
export function toCollaboratorQuoteView(
  project: ProjectDetailType,
  tasks: ProjectTaskType[],
  viewerId: number | null | undefined
): { project: CollaboratorQuoteProject; tasks: ProjectTaskType[] } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sale_price, ...safeProject } = project;
  return { project: safeProject, tasks: tasks.map((task) => hideOtherTaskCost(task, viewerId)) };
}
