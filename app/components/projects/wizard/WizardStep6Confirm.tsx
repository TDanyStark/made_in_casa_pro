"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/services/apiService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, User, Package, Tag, HardDrive } from "lucide-react";
import { WizardState } from "@/hooks/useProjectWizard";
import { ProjectType } from "@/lib/definitions";

interface Props {
  state: WizardState;
  onBack: () => void;
}

export function WizardStep6Confirm({ state, onBack }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!state.brand_id || !state.manager_id || !state.title) {
      toast.error("Faltan datos obligatorios");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the project
      const projectRes = await post<ProjectType>("projects", {
        title: state.title,
        brand_id: state.brand_id,
        manager_id: state.manager_id,
        campaign_id: state.campaign_id ?? null,
        drive_folder_id: state.drive_folder_id ?? null,
        drive_folder_url: state.drive_folder_url ?? null,
        notes: state.notes || null,
      });

      if (!projectRes.ok || !projectRes.data) {
        throw new Error(projectRes.error ?? "Error al crear el proyecto");
      }
      const project = projectRes.data as unknown as ProjectType;

      // 2. Add co-managers
      for (const managerId of state.co_manager_ids) {
        await post(`projects/${project.id}/managers`, { manager_id: managerId });
      }

      // 3. Add products (auto-instantiates tasks)
      for (const product of state.products) {
        await post(`projects/${project.id}/products`, { product_id: product.id });
      }

      toast.success("¡Proyecto creado exitosamente!");
      router.push(`/projects/${project.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <h3 className="font-semibold text-base">{state.title}</h3>

        <div className="grid gap-3 text-sm">
          {/* Brand */}
          <div className="flex items-start gap-3">
            <span className="text-muted-foreground min-w-24">Marca</span>
            <span className="font-medium">
              {state.brand_name}
              {state.client_name && (
                <span className="text-muted-foreground font-normal ml-1">
                  — {state.client_name}
                </span>
              )}
            </span>
          </div>

          {/* Manager */}
          <div className="flex items-start gap-3">
            <span className="text-muted-foreground min-w-24 flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> Gerente
            </span>
            <div>
              <span className="font-medium">{state.manager_name}</span>
              {state.co_manager_names.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {state.co_manager_names.map((n, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {n}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Products */}
          <div className="flex items-start gap-3">
            <span className="text-muted-foreground min-w-24 flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> Productos
            </span>
            <div className="flex flex-wrap gap-1">
              {state.products.map((p) => (
                <Badge key={p.id} variant="outline" className="text-xs">
                  {p.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Campaign */}
          {state.campaign_name && (
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground min-w-24 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> Campaña
              </span>
              <span className="font-medium">{state.campaign_name}</span>
            </div>
          )}

          {/* Drive */}
          {state.drive_folder_url && (
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground min-w-24 flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" /> Drive
              </span>
              <a
                href={state.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-xs"
              >
                Ver carpeta
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Las tareas se crearán automáticamente a partir de las plantillas de cada producto.
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          Atrás
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="min-w-36"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creando proyecto...
            </>
          ) : (
            "Crear proyecto"
          )}
        </Button>
      </div>
    </div>
  );
}
