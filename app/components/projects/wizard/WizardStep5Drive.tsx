"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/services/apiService";
import { toast } from "sonner";
import { HardDrive, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { WizardState } from "@/hooks/useProjectWizard";

interface DriveResult {
  projectFolderId: string;
  projectFolderUrl: string;
}

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
}

export function WizardStep5Drive({ state, onNext, onBack }: Props) {
  const [notes, setNotes] = useState(state.notes);
  const [creatingDrive, setCreatingDrive] = useState(false);
  const [driveCreated, setDriveCreated] = useState(!!state.drive_folder_url);

  const handleCreateDrive = async () => {
    if (!state.brand_id || !state.client_name) {
      toast.error("Completa la marca y el cliente antes de crear la carpeta");
      return;
    }

    setCreatingDrive(true);
    try {
      const res = await post<DriveResult>("drive/create-folder", {
        clientName: state.client_name,
        brandName: state.brand_name,
        projectTitle: state.title,
        productNames: state.products.map((p) => p.name),
      });

      if (!res.ok || !res.data) throw new Error(res.error);

      const result = res.data as unknown as DriveResult;
      onNext({
        drive_folder_id: result.projectFolderId,
        drive_folder_url: result.projectFolderUrl,
        notes,
      });
      setDriveCreated(true);
      toast.success("Carpetas de Drive creadas correctamente");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al crear carpetas";
      toast.error(msg);
    } finally {
      setCreatingDrive(false);
    }
  };

  const handleNext = () => {
    onNext({ notes });
  };

  return (
    <div className="space-y-6">
      {/* Google Drive section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          Carpeta en Google Drive
        </h3>

        {driveCreated && state.drive_folder_url ? (
          <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Carpeta creada correctamente
              </p>
              <a
                href={state.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:underline flex items-center gap-1 mt-0.5"
              >
                Abrir en Drive
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Se creará la estructura:{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                Made In Casa / {state.client_name || "Cliente"} / {state.brand_name || "Marca"} / {state.title || "Proyecto"} / [productos]
              </code>
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleCreateDrive}
              disabled={creatingDrive || !state.title || !state.brand_id}
              className="w-full"
            >
              {creatingDrive ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando carpetas...
                </>
              ) : (
                <>
                  <HardDrive className="h-4 w-4 mr-2" />
                  Crear carpetas en Drive
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Notas del proyecto{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Soporta formato Markdown. Podrás editarlo también desde el proyecto.
        </p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="## Objetivo del proyecto&#10;&#10;Describe los objetivos, alcance y notas relevantes..."
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button type="button" onClick={handleNext}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
