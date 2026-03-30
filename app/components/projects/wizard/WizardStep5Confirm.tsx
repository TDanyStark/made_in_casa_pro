"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { post } from "@/lib/services/apiService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  CheckCircle2,
  User,
  Package,
  Tag,
  HardDrive,
} from "lucide-react";
import { WizardState } from "@/hooks/useProjectWizard";
import { ProjectType } from "@/lib/definitions";

const RichTextEditor = dynamic(
  () => import("@/components/clients/RichTextEditor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[250px] w-full rounded-md" />,
  }
);

interface DriveResult {
  projectFolderId: string;
  projectFolderUrl: string;
}

interface Props {
  state: WizardState;
  onBack: () => void;
}

export function WizardStep5Confirm({ state, onBack }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(state.notes);
  const [submitting, setSubmitting] = useState(false);
  const [currentAction, setCurrentAction] = useState("");

  const handleConfirm = async () => {
    if (!state.brand_id || !state.manager_id || !state.title || !state.product) {
      toast.error("Faltan datos obligatorios");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Drive folder (mandatory)
      setCurrentAction("Creando carpeta en Drive...");

      // Collect emails: manager principal + co-managers
      const shareEmails = [
        state.manager_email,
        ...state.co_manager_emails,
      ].filter(Boolean);

      const driveRes = await post<DriveResult>("drive/create-folder", {
        clientName: state.client_name,
        brandName: state.brand_name,
        projectTitle: state.title,
        shareEmails,
      });

      if (!driveRes.ok || !driveRes.data) {
        throw new Error(driveRes.error ?? "Error al crear la carpeta en Drive");
      }

      const drive = driveRes.data as unknown as DriveResult;

      // 2. Create the project
      setCurrentAction("Creando proyecto...");
      const projectRes = await post<ProjectType>("projects", {
        title: state.title,
        brand_id: state.brand_id,
        manager_id: state.manager_id,
        campaign_id: state.campaign_id ?? null,
        drive_folder_id: drive.projectFolderId,
        drive_folder_url: drive.projectFolderUrl,
        notes: notes || null,
      });

      if (!projectRes.ok || !projectRes.data) {
        throw new Error(projectRes.error ?? "Error al crear el proyecto");
      }
      const project = projectRes.data as unknown as ProjectType;

      // 3. Add co-managers
      if (state.co_manager_ids.length > 0) {
        setCurrentAction("Asignando co-responsables...");
        for (const managerId of state.co_manager_ids) {
          await post(`projects/${project.id}/managers`, { manager_id: managerId });
        }
      }

      // 4. Add product (auto-instantiates tasks)
      if (state.product) {
        setCurrentAction("Agregando producto...");
        await post(`projects/${project.id}/products`, {
          product_id: state.product.id,
        });
      }

      toast.success("¡Proyecto creado exitosamente!");
      router.push(`/projects/${project.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast.error(msg);
      setSubmitting(false);
      setCurrentAction("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
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

          {/* Product */}
          <div className="flex items-start gap-3">
            <span className="text-muted-foreground min-w-24 flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> Producto
            </span>
            <div>
              {state.product ? (
                <Badge variant="outline" className="text-xs">
                  {state.product.name}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">Sin producto</span>
              )}
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

          {/* Drive — always created */}
          <div className="flex items-start gap-3">
            <span className="text-muted-foreground min-w-24 flex items-center gap-1">
              <HardDrive className="h-3.5 w-3.5" /> Drive
            </span>
            <span className="text-xs text-muted-foreground">
              Se creará automáticamente al confirmar
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Notas del proyecto{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <div className={submitting ? "opacity-50 pointer-events-none" : ""}>
          <RichTextEditor
            value={notes}
            onChange={setNotes}
            placeholder="Describe los objetivos, alcance y notas relevantes..."
            expandable={true}
            title="Notas del proyecto"
          />
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
          className="min-w-44"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {currentAction || "Procesando..."}
            </>
          ) : (
            "Crear proyecto"
          )}
        </Button>
      </div>
    </div>
  );
}
