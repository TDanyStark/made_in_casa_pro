"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Folder, User, Tag, Package, FileText, HardDrive } from "lucide-react";
import { WizardState } from "@/hooks/useProjectWizard";

interface ProjectPreviewCardProps {
  state: WizardState;
}

export function ProjectPreviewCard({ state }: ProjectPreviewCardProps) {
  const progress = 0;

  return (
    <Card className="sticky top-6 border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">
          <Folder className="h-3.5 w-3.5" />
          Vista previa del proyecto
        </div>
        <h3 className="text-xl font-bold leading-tight min-h-7 text-primary">
          {state.title || <span className="text-muted-foreground/40 italic font-normal">Sin título aún...</span>}
        </h3>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Brand / Client */}
        <div className="space-y-1.5">
          {state.brand_name && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{state.brand_name}</span>
              {state.client_name && (
                <span className="text-muted-foreground text-xs">· {state.client_name}</span>
              )}
            </div>
          )}
        </div>

        {/* Manager */}
        {state.manager_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">{state.manager_name}</span>
            {state.co_manager_names.length > 0 && (
              <span className="text-xs">
                + {state.co_manager_names.length} co-responsable{state.co_manager_names.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Product */}
        {state.product && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Package className="h-3.5 w-3.5" />
            <Badge variant="secondary" className="text-xs">
              {state.product.name}
            </Badge>
          </div>
        )}

        {/* Campaign */}
        {state.campaign_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">{state.campaign_name}</span>
          </div>
        )}

        {/* Drive */}
        {state.drive_folder_url && (
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="h-3.5 w-3.5 shrink-0 text-green-500" />
            <a
              href={state.drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 hover:underline truncate"
            >
              Carpeta de Drive creada
            </a>
          </div>
        )}

        {/* Notes preview */}
        {state.notes && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p className="text-xs line-clamp-3 italic">{state.notes}</p>
          </div>
        )}

        {/* Progress bar */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progreso</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status */}
        <Badge variant="outline" className="w-fit text-xs">
          Activo
        </Badge>
      </CardContent>
    </Card>
  );
}

export default ProjectPreviewCard;
