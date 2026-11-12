"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import type { ProjectFinancialsView } from "@/lib/queries/projectFinancials";

/**
 * Horas y dinero invertidos en un proyecto (solo dirección).
 * Con `adjustmentId` cuenta solo esa versión; el margen entonces llega en null.
 */
export function useProjectFinancials(projectId: number, adjustmentId: number | null) {
  return useQuery({
    queryKey: ["project-financials", projectId, adjustmentId],
    queryFn: async () => {
      const query = adjustmentId === null ? "" : `?adjustment_id=${adjustmentId}`;
      const res = await get<ProjectFinancialsView>(`projects/${projectId}/financials${query}`);
      if (!res.ok) throw new Error(res.error);
      return res.data as ProjectFinancialsView;
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });
}
