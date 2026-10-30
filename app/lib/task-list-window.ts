/**
 * Decides which tasks of a version list are stacked, visible or hidden so long
 * lists stay short without burying the work that needs attention:
 * - Lists with TASK_STACK_THRESHOLD tasks or fewer are shown in full.
 * - Leading completed tasks collapse into a stack (expand it to reorder them).
 * - Tasks needing attention (in progress, paused, blocked, waiting) are always
 *   visible, followed by TASK_PAGE_SIZE upcoming tasks per loaded page.
 * stacked + visible + hidden always preserves the original order, so the visible
 * slice can be reordered and spliced back into the full list.
 */
export const TASK_STACK_THRESHOLD = 8;
export const TASK_PAGE_SIZE = 4;

const ATTENTION_STATUSES = new Set(["in_progress", "paused", "blocked", "waiting"]);

export interface TaskListWindowOptions {
  showCompleted: boolean;
  extraPages: number;
  showAll: boolean;
}

export interface TaskListWindow<T> {
  stacked: T[];
  visible: T[];
  hidden: T[];
}

export function getTaskListWindow<T extends { status: string }>(
  tasks: T[],
  { showCompleted, extraPages, showAll }: TaskListWindowOptions
): TaskListWindow<T> {
  if (tasks.length <= TASK_STACK_THRESHOLD) {
    return { stacked: [], visible: tasks, hidden: [] };
  }

  let completedPrefix = 0;
  while (completedPrefix < tasks.length && tasks[completedPrefix].status === "completed") {
    completedPrefix++;
  }

  const lead = tasks.slice(0, completedPrefix);
  const rest = tasks.slice(completedPrefix);

  let lastAttention = -1;
  rest.forEach((task, index) => {
    if (ATTENTION_STATUSES.has(task.status)) lastAttention = index;
  });

  const visibleCount = showAll
    ? rest.length
    : lastAttention + 1 + TASK_PAGE_SIZE * (1 + Math.max(0, extraPages));

  return {
    stacked: showCompleted ? [] : lead,
    visible: [...(showCompleted ? lead : []), ...rest.slice(0, visibleCount)],
    hidden: rest.slice(visibleCount),
  };
}
