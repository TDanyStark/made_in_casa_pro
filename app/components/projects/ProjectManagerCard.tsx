"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, UserCog } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { get } from "@/lib/services/apiService";
import { ProjectDetailType, ProjectManagerHistoryEntry } from "@/lib/definitions";

interface HistoryResponse {
  history: ProjectManagerHistoryEntry[];
}

/**
 * Gerente principal del proyecto + historial de reasignaciones.
 *
 * Solo lectura: el gerente de un proyecto es siempre el de su marca principal
 * y se cambia reasignando la marca (ver `updateBrand`).
 */
export function ProjectManagerCard({
  project,
}: {
  project: ProjectDetailType;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["project-manager-history", project.id],
    queryFn: async () => {
      const res = await get<HistoryResponse>(
        `projects/${project.id}/manager-history`
      );
      if (!res.ok) throw new Error(res.error);
      return res.data as unknown as HistoryResponse;
    },
    staleTime: 1000 * 60 * 5,
  });

  const history = data?.history ?? [];

  return (
    <div className="space-y-6 rounded-lg border p-4 max-w-lg">
      <div className="space-y-1">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <UserCog className="h-3.5 w-3.5" />
          Gerente principal
        </h3>
        <p className="text-sm">{project.manager_name}</p>
        <p className="text-xs text-muted-foreground">
          {`Para cambiar el gerente, reasigna la marca ${project.brand_name} a otro gerente.`}
        </p>
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium">Historial de gerentes</h4>
        {isLoading ? (
          <Skeleton className="h-4 w-1/2 mt-2" />
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-2">
            Este proyecto no ha cambiado de gerente.
          </p>
        ) : (
          <ol className="relative border-l border-muted mt-4">
            {history.map((entry) => (
              <li key={entry.id} className="mb-5 ml-6">
                <span className="absolute flex items-center justify-center w-6 h-6 bg-primary/10 rounded-full -left-3 ring-8 ring-background">
                  <CalendarClock className="w-3 h-3 text-primary" />
                </span>
                <p className="text-sm font-medium">
                  {entry.previousManagerName ?? "Sin gerente"}{" "}
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>{" "}
                  {entry.newManagerName ?? "Gerente"}
                </p>
                <time className="block text-xs text-muted-foreground">
                  {format(new Date(entry.changedAt), "dd/MM/yyyy HH:mm")}
                </time>
                {entry.changedByName && (
                  <p className="text-xs text-muted-foreground">
                    Registrado por {entry.changedByName}
                  </p>
                )}
                {entry.reason && (
                  <p className="text-xs text-muted-foreground">
                    Motivo: {entry.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default ProjectManagerCard;
