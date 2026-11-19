"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { del } from "@/lib/services/apiService";
import { formatMoney } from "@/lib/utils/format-money";
import type { ProjectCostType } from "@/lib/definitions";
import { projectCostsKey, useProjectCosts } from "@/hooks/useProjectCosts";
import { ProjectVersionSelect } from "./ProjectFinancialCards";
import { ProjectCostDialog } from "./costs/ProjectCostDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Spec: odd/tasks/project-costs.md — S1 (Costos tab), S3, S5 (version filter), S6.

/** "2025-03-10" -> "10/03/2025", without time zone shifts. */
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type DialogState = { cost: ProjectCostType | null } | null;

export function ProjectCostsTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [adjustmentId, setAdjustmentId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const { data, isLoading, isError } = useProjectCosts(projectId, adjustmentId);

  const remove = async (cost: ProjectCostType) => {
    const res = await del(`projects/${projectId}/costs/${cost.id}`);
    if (!res.ok) {
      toast.error(res.error || "Error al eliminar el costo");
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projectCostsKey(projectId) }),
      queryClient.invalidateQueries({ queryKey: ["project-financials", projectId] }),
    ]);
    toast.success("Costo eliminado");
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">No se pudieron cargar los costos del proyecto.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="leading-tight">
          <h3 className="text-base font-semibold">Costos asociados</h3>
          <p className="text-sm text-muted-foreground">
            Cobros que no son costo de tareas y suman al costo total del proyecto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectVersionSelect versions={data.versions} value={adjustmentId} onChange={setAdjustmentId} />
          <Button size="sm" onClick={() => setDialog({ cost: null })}>
            <Plus />
            Agregar costo
          </Button>
        </div>
      </div>

      {data.costs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <Receipt className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aún no hay costos registrados para este proyecto.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Versión</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Registrado por</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.costs.map((cost) => (
                <TableRow key={cost.id} data-testid="project-cost-row">
                  <TableCell className="tabular-nums">{formatDate(cost.incurred_at)}</TableCell>
                  <TableCell className="font-medium">{cost.category_name}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                    {cost.description ?? "—"}
                  </TableCell>
                  <TableCell>{`V${cost.version_number}`}</TableCell>
                  <TableCell className="max-w-48 truncate">{cost.task_title ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="project-cost-amount">
                    {formatMoney(cost.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{cost.created_by_name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Editar costo"
                        onClick={() => setDialog({ cost })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label="Eliminar costo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar costo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {`Se eliminará el costo de ${formatMoney(cost.amount)} (${cost.category_name}) y dejará de contar en la rentabilidad del proyecto.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => remove(cost)}
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums" data-testid="project-costs-total">
                  {formatMoney(data.total)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {dialog && (
        <ProjectCostDialog
          projectId={projectId}
          versions={data.versions}
          cost={dialog.cost}
          defaultAdjustmentId={adjustmentId}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
