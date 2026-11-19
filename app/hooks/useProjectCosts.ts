"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import type {
  ProjectCostCategoryType,
  ProjectCostType,
  ProjectCostsTotalType,
  ProjectTaskType,
} from "@/lib/definitions";
import type { ProjectVersion } from "@/lib/queries/projectFinancials";

// Spec: odd/tasks/project-costs.md — S1, S3, S5, S6.

/** GET /api/projects/[id]/costs: the costs (filtered by version), their total and every project version. */
export type ProjectCostsView = ProjectCostsTotalType & {
  costs: ProjectCostType[];
  versions: ProjectVersion[];
  adjustment_id: number | null;
};

/** Prefix shared by every version filter; invalidate it after a cost mutation. */
export const projectCostsKey = (projectId: number) => ["project-costs", projectId] as const;

export const COST_CATEGORIES_KEY = ["project-cost-categories"] as const;

/** Associated costs of a project; with `adjustmentId` only that version's. */
export function useProjectCosts(projectId: number, adjustmentId: number | null) {
  return useQuery({
    queryKey: [...projectCostsKey(projectId), adjustmentId],
    queryFn: async () => {
      const query = adjustmentId === null ? "" : `?adjustment_id=${adjustmentId}`;
      const res = await get<ProjectCostsView>(`projects/${projectId}/costs${query}`);
      if (!res.ok) throw new Error(res.error);
      return res.data as ProjectCostsView;
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });
}

/** Every cost category, shared by all projects. */
export function useCostCategories(enabled = true) {
  return useQuery({
    queryKey: COST_CATEGORIES_KEY,
    queryFn: async () => {
      const res = await get<{ data: ProjectCostCategoryType[] }>("project-cost-categories");
      if (!res.ok) throw new Error(res.error);
      return res.data?.data ?? [];
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

/** Tasks of one version of the project; same cache key as the tasks tab. */
export function useVersionTasks(projectId: number, adjustmentId: number | null) {
  return useQuery({
    queryKey: ["project-tasks", projectId, adjustmentId],
    queryFn: async () => {
      const res = await get<ProjectTaskType[]>(`projects/${projectId}/tasks?adjustment_id=${adjustmentId}`);
      if (!res.ok) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: adjustmentId !== null,
    staleTime: 1000 * 60,
  });
}
