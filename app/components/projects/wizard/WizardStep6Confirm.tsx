"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { post, patch, get, del } from "@/lib/services/apiService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { WizardState } from "@/hooks/useProjectWizard";
import { ProjectType, ProjectTaskType } from "@/lib/definitions";
import {
  normalizeOptionalProjectText,
  normalizeProjectDateTime,
} from "@/lib/utils/project-date-time";

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

export function WizardStep6Confirm({ state, onBack }: Props) {
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
        ideal_delivery_at: state.ideal_delivery_at
          ? normalizeProjectDateTime(state.ideal_delivery_at)
          : null,
        oc: normalizeOptionalProjectText(state.oc),
        billing_closed_at: state.billing_closed_at
          ? normalizeProjectDateTime(state.billing_closed_at)
          : null,
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

      // 4. Add product (auto-instantiates tasks from templates)
      if (state.product) {
        setCurrentAction("Agregando producto...");
        await post(`projects/${project.id}/products`, {
          product_id: state.product.id,
        });
      }

      // 5. Apply task customizations
      if (
        state.task_overrides.length > 0 ||
        state.removed_template_ids.length > 0 ||
        state.extra_tasks.length > 0
      ) {
        setCurrentAction("Configurando tareas...");

        // Fetch the created project tasks (instantiated from product)
        const tasksRes = await get<ProjectTaskType[]>(`projects/${project.id}/tasks`);
        const createdTasks = tasksRes.ok ? (tasksRes.data ?? []) : [];

        // B. Handle DELETIONS (removed template tasks)
        if (state.removed_template_ids.length > 0) {
          for (const templateId of state.removed_template_ids) {
            const taskToDelete = createdTasks.find(
              (t) => t.template_id === templateId
            );
            if (taskToDelete) {
              await del(`projects/${project.id}/tasks/${taskToDelete.id}`);
            }
          }
        }

        // C. Handle UPDATES (task_overrides)
        for (const override of state.task_overrides) {
          const createdTask = createdTasks.find(
            (t) => t.template_id === override.template_id
          );
          if (!createdTask) continue;

          const hasChanges =
            override.title !== undefined || 
            override.assigned_user_id !== undefined ||
            override.assign_to_commercial !== undefined;

          if (hasChanges) {
            await patch(`projects/${project.id}/tasks/${createdTask.id}`, {
              ...(override.title !== undefined && { title: override.title }),
              ...(override.assigned_user_id !== undefined && {
                assigned_user_id: override.assigned_user_id,
              }),
              ...(override.assign_to_commercial !== undefined && {
                assign_to_commercial: override.assign_to_commercial,
              }),
            });
          }
        }

        // D. Handle EXTRA TASKS (ad-hoc)
        const extraTaskMap = new Map<number, number>();
        if (state.extra_tasks.length > 0) {
          for (const extra of state.extra_tasks) {
            const res = await post<ProjectTaskType>(`projects/${project.id}/tasks`, {
              title: extra.title,
              assigned_user_id: extra.assigned_user_id,
              assign_to_commercial: extra.assign_to_commercial,
              area_id: extra.area_id,
              task_type: extra.task_type,
            });
            if (res.ok && res.data) {
              const createdExtra = res.data as unknown as ProjectTaskType;
              extraTaskMap.set(extra.localId, createdExtra.id);
            }
          }
        }

        // E. Handle FINAL REORDER
        const finalOrderedList = [
          ...state.task_overrides.map((o) => ({
            id: createdTasks.find((t) => t.template_id === o.template_id)?.id,
            order_index: o.order_index ?? 0,
          })),
          ...state.extra_tasks.map((e) => ({
            id: extraTaskMap.get(e.localId),
            order_index: e.order_index,
          })),
        ];

        const orderedIds = finalOrderedList
          .sort((a, b) => a.order_index - b.order_index)
          .map((item) => item.id)
          .filter((id): id is number => id !== undefined);

        if (orderedIds.length > 1) {
          await post(`projects/${project.id}/tasks/reorder`, {
            orderedIds,
          });
        }
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
