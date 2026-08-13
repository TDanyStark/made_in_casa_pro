"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarClock, Loader2, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { ManagerSelect } from "@/components/managers/ManagerSelect";
import { get, patch } from "@/lib/services/apiService";
import { ProjectDetailType, ProjectManagerHistoryEntry } from "@/lib/definitions";

interface HistoryResponse {
  history: ProjectManagerHistoryEntry[];
}

type ManagerFormValues = { manager_id: number | undefined };

/**
 * Cambio de gerente principal del proyecto + historial de reasignaciones.
 *
 * El select se filtra a `projects.client_id`: el backend rechaza gerentes de
 * otro cliente con `MANAGER_CLIENT_MISMATCH`, así que la UI ni siquiera debe
 * ofrecerlos.
 */
export function ProjectManagerCard({
  project,
  canEdit,
}: {
  project: ProjectDetailType;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ManagerFormValues>({
    defaultValues: { manager_id: project.manager_id },
  });

  useEffect(() => {
    form.reset({ manager_id: project.manager_id });
  }, [project.manager_id, form]);

  const selectedManagerId = form.watch("manager_id");

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

  const handleSave = async () => {
    if (!selectedManagerId || selectedManagerId === project.manager_id) return;

    setIsSaving(true);
    try {
      const res = await patch(`projects/${project.id}`, {
        manager_id: selectedManagerId,
      });

      if (!res.ok) {
        const code = (res.data as { code?: string } | undefined)?.code;
        throw new Error(
          code === "MANAGER_CLIENT_MISMATCH"
            ? "Ese gerente pertenece a otro cliente. Elige uno de " +
              `${project.client_name}.`
            : res.error || "Error al cambiar el gerente"
        );
      }

      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({
        queryKey: ["project-manager-history", project.id],
      });
      toast.success("Gerente principal actualizado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cambiar el gerente"
      );
      form.reset({ manager_id: project.manager_id });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 rounded-lg border p-4 max-w-lg">
      <div className="space-y-1">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <UserCog className="h-3.5 w-3.5" />
          Gerente principal
        </h3>
        <p className="text-xs text-muted-foreground">
          Solo gerentes de {project.client_name}.
        </p>
      </div>

      {canEdit ? (
        <Form {...form}>
          <div className="space-y-3">
            <ManagerSelect
              form={form}
              control={form.control}
              name="manager_id"
              label="Cambiar gerente principal"
              placeholder={project.manager_name}
              clientId={project.client_id}
            />
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                isSaving ||
                !selectedManagerId ||
                selectedManagerId === project.manager_id
              }
            >
              {isSaving && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Asignar gerente
            </Button>
          </div>
        </Form>
      ) : (
        <p className="text-sm text-muted-foreground">{project.manager_name}</p>
      )}

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
