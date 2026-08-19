"use client";

import { useEffect, useMemo, useState } from "react";
import { ProjectDetailType } from "@/lib/definitions";
import { CampaignSelect } from "./CampaignSelect";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { patch, post } from "@/lib/services/apiService";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, User, Package, Tag, HardDrive, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  formatProjectDateTimeForDisplay,
  formatProjectDateTimeForInput,
  normalizeOptionalProjectText,
  normalizeProjectDateTime,
} from "@/lib/utils/project-date-time";
import { ProjectDriveAccessManager } from "./ProjectDriveAccessManager";

interface Props {
  project: ProjectDetailType;
  canEdit: boolean;
}

export function ProjectInfoTab({ project, canEdit }: Props) {
  const queryClient = useQueryClient();
  const initialMetadata = useMemo(
    () => ({
      ideal_delivery_at: formatProjectDateTimeForInput(project.ideal_delivery_at),
      oc: project.oc ?? "",
      billing_closed_at: formatProjectDateTimeForInput(project.billing_closed_at),
    }),
    [project.billing_closed_at, project.ideal_delivery_at, project.oc]
  );
  const [metadata, setMetadata] = useState(initialMetadata);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  useEffect(() => {
    setMetadata(initialMetadata);
  }, [initialMetadata]);

  const initialDriveUrl = project.drive_folder_url ?? "";
  const [driveUrl, setDriveUrl] = useState(initialDriveUrl);
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [isRecreatingDrive, setIsRecreatingDrive] = useState(false);

  useEffect(() => {
    setDriveUrl(initialDriveUrl);
  }, [initialDriveUrl]);

  const handleCampaignChange = async (id: number | null, name?: string) => {
    try {
      const res = await patch(`projects/${project.id}`, { campaign_id: id ?? null });
      if (!res.ok) throw new Error(res.error);
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(id ? `Campaña "${name}" asociada` : "Campaña desvinculada");
    } catch {
      toast.error("Error al actualizar la campaña");
    }
  };

  const createdAt = project.created_at
    ? format(new Date(project.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })
    : "—";

  const updatedAt = project.updated_at
    ? format(new Date(project.updated_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })
    : "—";

  const hasMetadataChanges =
    metadata.ideal_delivery_at !== initialMetadata.ideal_delivery_at ||
    metadata.oc !== initialMetadata.oc ||
    metadata.billing_closed_at !== initialMetadata.billing_closed_at;

  const handleMetadataChange = (
    field: "ideal_delivery_at" | "oc" | "billing_closed_at",
    value: string
  ) => {
    setMetadata((current) => ({ ...current, [field]: value }));
  };

  const handleMetadataReset = () => {
    setMetadata(initialMetadata);
  };

  const handleMetadataSave = async () => {
    try {
      setIsSavingMetadata(true);
      const res = await patch(`projects/${project.id}`, {
        ideal_delivery_at: metadata.ideal_delivery_at
          ? normalizeProjectDateTime(metadata.ideal_delivery_at)
          : null,
        oc: normalizeOptionalProjectText(metadata.oc),
        billing_closed_at: metadata.billing_closed_at
          ? normalizeProjectDateTime(metadata.billing_closed_at)
          : null,
      });

      if (!res.ok) throw new Error(res.error);

      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Información del proyecto actualizada");
    } catch {
      toast.error("Error al actualizar la información del proyecto");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const hasDriveUrlChanges = driveUrl !== initialDriveUrl;

  const handleDriveUrlReset = () => {
    setDriveUrl(initialDriveUrl);
  };

  const handleDriveUrlSave = async () => {
    try {
      setIsSavingDrive(true);
      const res = await patch(`projects/${project.id}`, {
        drive_folder_url: driveUrl.trim(),
      });

      if (!res.ok) throw new Error(res.error);

      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(
        driveUrl.trim() ? "Carpeta de Drive actualizada" : "Carpeta de Drive desvinculada"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al actualizar la carpeta de Drive"
      );
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handleRecreateDrive = async () => {
    try {
      setIsRecreatingDrive(true);
      const res = await post<{ projectFolderId: string; projectFolderUrl: string }>(
        `projects/${project.id}/drive/recreate`,
        {}
      );

      if (!res.ok) throw new Error(res.error);

      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Carpeta de Drive recreada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al recrear la carpeta de Drive"
      );
    } finally {
      setIsRecreatingDrive(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* Campaign */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          Campaña asociada
        </label>
        {canEdit ? (
          <CampaignSelect
            value={project.campaign_id}
            initialLabel={project.campaign_name}
            clientId={project.client_id}
            onChange={handleCampaignChange}
            placeholder="Sin campaña — buscar o crear..."
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {project.campaign_name ?? "Sin campaña"}
          </p>
        )}
      </div>

      {/* Product */}
      <div className="space-y-1">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" />
          Producto
        </p>
        <p className="text-sm text-muted-foreground">
          {project.product_name ?? "Sin producto"}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground">Metadatos del proyecto</h3>
          <p className="text-xs text-muted-foreground">
            El cierre de facturación es administrativo y se mantiene separado de la finalización del proyecto.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-ideal-delivery">Fecha ideal de entrega</Label>
          {canEdit ? (
            <Input
              id="project-ideal-delivery"
              type="datetime-local"
              value={metadata.ideal_delivery_at}
              onChange={(event) => handleMetadataChange("ideal_delivery_at", event.target.value)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {formatProjectDateTimeForDisplay(project.ideal_delivery_at) ?? "Sin definir"}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-oc">OC</Label>
          {canEdit ? (
            <Input
              id="project-oc"
              value={metadata.oc}
              onChange={(event) => handleMetadataChange("oc", event.target.value)}
              placeholder="Sin OC"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{project.oc ?? "Sin OC"}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-billing-closed-at">Cierre de facturación</Label>
          {canEdit ? (
            <Input
              id="project-billing-closed-at"
              type="datetime-local"
              value={metadata.billing_closed_at}
              onChange={(event) => handleMetadataChange("billing_closed_at", event.target.value)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {formatProjectDateTimeForDisplay(project.billing_closed_at) ?? "Sin cierre de facturación"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Corresponde al cierre administrativo/facturación, no a <code>completed_at</code>.
          </p>
        </div>

        {canEdit && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleMetadataReset}
              disabled={isSavingMetadata || !hasMetadataChanges}
            >
              Restablecer
            </Button>
            <Button
              type="button"
              onClick={handleMetadataSave}
              disabled={isSavingMetadata || !hasMetadataChanges}
            >
              {isSavingMetadata ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}

        {project.drive_folder_id && (
          <ProjectDriveAccessManager projectId={project.id} canEdit={canEdit} />
        )}
      </div>

      {/* Drive folder */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            Carpeta en Drive
          </h3>
          <p className="text-xs text-muted-foreground">
            Vincula o corrige manualmente la carpeta de Google Drive de este proyecto.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Carpeta actual</Label>
          {project.drive_folder_url ? (
            <div>
              <Button variant="outline" size="sm" asChild>
                <a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer">
                  <HardDrive className="h-3.5 w-3.5 mr-1.5" />
                  Abrir carpeta
                  <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                </a>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin carpeta vinculada</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-drive-url">URL personalizada</Label>
          {canEdit ? (
            <Input
              id="project-drive-url"
              value={driveUrl}
              onChange={(event) => setDriveUrl(event.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {project.drive_folder_url ?? "Sin carpeta vinculada"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Debe ser un enlace de drive.google.com. Dejar vacío y guardar para desvincular.
          </p>
        </div>

        {canEdit && (
          <div className="flex justify-between items-center gap-2 pt-2 flex-wrap">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={isRecreatingDrive}>
                  {isRecreatingDrive ? "Recreando..." : "Recrear carpeta"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Recrear carpeta de Drive</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se buscara o creara la carpeta del proyecto en Google Drive (cliente → marca →
                    proyecto) y se vinculara automaticamente. Si ya existe una carpeta con el mismo
                    nombre, se reutilizara en lugar de crear una duplicada.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRecreateDrive} disabled={isRecreatingDrive}>
                    {isRecreatingDrive ? "Recreando..." : "Recrear carpeta"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDriveUrlReset}
                disabled={isSavingDrive || !hasDriveUrlChanges}
              >
                Restablecer
              </Button>
              <Button
                type="button"
                onClick={handleDriveUrlSave}
                disabled={isSavingDrive || !hasDriveUrlChanges}
              >
                {isSavingDrive ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-2 text-sm text-muted-foreground border-t pt-4">
        {project.created_by_name && (
          <p className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 shrink-0" />
            Creado por{" "}
            <span className="text-foreground font-medium">{project.created_by_name}</span>
          </p>
        )}
        <p className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          Creado el {createdAt}
        </p>
        <p className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          Última actualización: {updatedAt}
        </p>
      </div>
    </div>
  );
}
