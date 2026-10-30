"use client";

/**
 * TaskAssignmentSelector
 *
 * A unified assignment widget for task forms (templates and project tasks).
 * Supports three modes:
 *   - "auto"       → area is selected, system picks the least-loaded internal
 *   - "commercial" → assigned at runtime to the project creator (created_by)
 *   - "specific"   → pick any active user from the organisation (optionally filtered by area)
 *
 * Props mirror the three form fields it controls:
 *   - assignMode       / onAssignModeChange
 *   - areaId           / onAreaIdChange
 *   - assignedUserId   / onAssignedUserIdChange
 *   - requiresQuote    (read-only, passed from parent to conditionally hide user selector)
 *
 * The component fetches users/areas internally; parent only gets values back via callbacks.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { AreaType } from "@/lib/definitions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Users, Zap, UserCheck, X, Search } from "lucide-react";
import { AssignableUserOption, UserPickerCombobox, useAssignableCollaborators } from "./UserPickerCombobox";

export type AssignMode = "auto" | "commercial" | "specific";

export const SPECIFIC_USER_REQUIRED_MESSAGE =
  "Debes seleccionar una persona cuando el modo es 'Persona específica'";
export const AUTO_AREA_REQUIRED_MESSAGE =
  "Selecciona un área para la auto-asignación, o cambia a otro modo";

/**
 * Assignment rules shared by every task form, so no task is saved without
 * someone (or some area) responsible for it:
 *   - "specific" requires a person.
 *   - "auto" requires an area (unless the task requires an external quote).
 */
export function getAssignmentErrors(values: {
  assignMode: AssignMode;
  areaId: number | null | undefined;
  assignedUserId: number | null | undefined;
  requiresQuote?: boolean;
}): { field: "assigned_user_id" | "area_id"; message: string }[] {
  const errors: { field: "assigned_user_id" | "area_id"; message: string }[] = [];
  if (values.assignMode === "specific" && !values.assignedUserId) {
    errors.push({ field: "assigned_user_id", message: SPECIFIC_USER_REQUIRED_MESSAGE });
  }
  if (values.assignMode === "auto" && !values.areaId && !values.requiresQuote) {
    errors.push({ field: "area_id", message: AUTO_AREA_REQUIRED_MESSAGE });
  }
  return errors;
}

type UserOption = AssignableUserOption;

interface Props {
  assignMode: AssignMode;
  onAssignModeChange: (mode: AssignMode) => void;

  areaId: number | null;
  onAreaIdChange: (id: number | null) => void;

  assignedUserId: number | null;
  onAssignedUserIdChange: (id: number | null) => void;

  /** Pre-selected external quoters (only relevant when requiresQuote=true) */
  quoterIds?: number[];
  onQuoterIdsChange?: (ids: number[]) => void;

  requiresQuote?: boolean;
  disabled?: boolean;
  projectId?: number;
}

export function TaskAssignmentSelector({
  assignMode,
  onAssignModeChange,
  areaId,
  onAreaIdChange,
  assignedUserId,
  onAssignedUserIdChange,
  quoterIds = [],
  onQuoterIdsChange,
  requiresQuote = false,
  disabled = false,
  projectId,
}: Props) {
  // For "auto" mode, only show areas that have at least one active internal collaborator
  const { data: areasForAuto = [], isError: areasError } = useQuery<AreaType[]>({
    queryKey: ["areas-with-active-internals"],
    queryFn: async () => {
      const res = await get<{ data: AreaType[] }>("areas?with_active_internals=1");
      if (!res.ok) throw new Error(res.error);
      return (res.data as unknown as { data: AreaType[] })?.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const areas = areasForAuto;

  // External collaborators (for "requires_quote" quoter selection)
  const { data: externalUsers = [], isError: externalUsersError } = useQuery<UserOption[]>({
    queryKey: ["external-collaborators-for-quote"],
    queryFn: async () => {
      const res = await get<UserOption[]>(`collaborators?only_external=1`);
      if (!res.ok) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: requiresQuote,
    staleTime: 1000 * 60 * 5,
  });

  // All active users (for "specific" mode)
  const { data: allUsers = [], isError: allUsersError } = useAssignableCollaborators(assignMode === "specific");

  const { data: previewUser, isLoading: isLoadingPreview, isError: isPreviewError } = useQuery<{ id: number; name: string } | null>({
    queryKey: ["least-loaded-preview", assignMode, areaId, projectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (assignMode === "commercial" && projectId) {
        params.set("mode", "commercial");
        params.set("project_id", projectId.toString());
      } else if (assignMode === "auto" && areaId) {
        params.set("area_id", areaId.toString());
      } else {
        return null;
      }
      const res = await get<{ data: { id: number; name: string } | null }>(`users/least-loaded?${params}`);
      if (!res.ok) throw new Error(res.error);
      return (res.data as unknown as { data: { id: number; name: string } | null })?.data ?? null;
    },
    enabled: (assignMode === "auto" && !!areaId) || (assignMode === "commercial" && !!projectId),
  });

  const [quoterSearch, setQuoterSearch] = useState("");
  const filteredExternals = externalUsers.filter((u) =>
    u.name.toLowerCase().includes(quoterSearch.toLowerCase()) ||
    (u.area_name ?? "").toLowerCase().includes(quoterSearch.toLowerCase())
  );

  // When mode changes, clear user or area as needed
  useEffect(() => {
    if (assignMode === "commercial") {
      onAssignedUserIdChange(null);
    } else if (assignMode === "auto") {
      onAssignedUserIdChange(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignMode]);


  return (
    <div className="space-y-3">
      {/* Mode selector + area — hidden when requiresQuote (externals don't use internal assignment) */}
      {!requiresQuote && (
        <>
          <div>
            <label className="text-sm font-medium block mb-1.5">Asignación</label>
            <div className="grid grid-cols-1 gap-2">
              {/* Specific */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAssignModeChange("specific")}
                className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                  assignMode === "specific"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted/50"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Users className={`h-4 w-4 mt-0.5 flex-shrink-0 ${assignMode === "specific" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium leading-none">Persona específica</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Selecciona cualquier usuario de la organización
                  </p>
                </div>
              </button>
              {/* Commercial */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAssignModeChange("commercial")}
                className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                  assignMode === "commercial"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted/50"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <UserCheck className={`h-4 w-4 mt-0.5 flex-shrink-0 ${assignMode === "commercial" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium leading-none">Comercial encargado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Se asigna automáticamente al comercial que crea el proyecto
                  </p>
                  {assignMode === "commercial" && projectId && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded">
                      {isLoadingPreview ? (
                        <span className="flex items-center gap-1"><Zap className="h-3 w-3 animate-pulse" /> Buscando...</span>
                      ) : isPreviewError ? (
                        <span className="flex items-center gap-1 text-destructive"><X className="h-3 w-3" /> Error al resolver la asignación</span>
                      ) : previewUser ? (
                        <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> Se asignará a: {previewUser.name}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive"><X className="h-3 w-3" /> Sin comercial asignado al proyecto</span>
                      )}
                    </div>
                  )}
                </div>
              </button>

              {/* Auto */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAssignModeChange("auto")}
                className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                  assignMode === "auto"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted/50"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Zap className={`h-4 w-4 mt-0.5 flex-shrink-0 ${assignMode === "auto" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium leading-none">Auto-asignación por área</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El sistema escoge el colaborador interno con menos carga del área seleccionada
                  </p>
                  {assignMode === "auto" && areaId && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded">
                      {isLoadingPreview ? (
                        <span className="flex items-center gap-1"><Zap className="h-3 w-3 animate-pulse" /> Resolviendo...</span>
                      ) : isPreviewError ? (
                        <span className="flex items-center gap-1 text-destructive"><X className="h-3 w-3" /> Error al resolver la asignación</span>
                      ) : previewUser ? (
                        <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> Se asignará a: {previewUser.name}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive"><X className="h-3 w-3" /> Sin colaborador disponible</span>
                      )}
                    </div>
                  )}
                </div>
              </button>

            </div>
          </div>

          {/* Area selector — shown only for auto mode */}
          {assignMode === "auto" && (
            <div>
              <label className="text-sm font-medium block mb-1.5">
                Área
                <span className="text-destructive ml-1">*</span>
              </label>
              <Select
                value={areaId?.toString() ?? ""}
                onValueChange={(v) => {
                  onAreaIdChange(v ? Number(v) : null);
                  onAssignedUserIdChange(null);
                }}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.id!} value={area.id!.toString()}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {areasError && (
                <p className="text-xs text-destructive mt-1">Error al cargar las áreas</p>
              )}
            </div>
          )}
        </>
      )}

      {/* User selector — only for "specific" mode (never shown when requiresQuote) */}
      {assignMode === "specific" && !requiresQuote && (
        <div>
          <label className="text-sm font-medium block mb-1.5">Persona asignada</label>
          <UserPickerCombobox
            users={allUsers}
            value={assignedUserId}
            onChange={onAssignedUserIdChange}
            disabled={disabled}
          />
          {allUsersError && (
            <p className="text-xs text-destructive mt-1">Error al cargar las personas</p>
          )}
        </div>
      )}

      {/* Quoters selector — only when requiresQuote is true */}
      {requiresQuote && onQuoterIdsChange && (
        <div className="space-y-2">
          <label className="text-sm font-medium block">
            Externos que cotizarán
            <span className="text-muted-foreground text-xs ml-1">(opcional — se invitarán automáticamente)</span>
          </label>

          {externalUsers.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador externo..."
                className="pl-9 h-9"
                value={quoterSearch}
                onChange={(e) => setQuoterSearch(e.target.value)}
                disabled={disabled}
              />
            </div>
          )}

          {externalUsersError ? (
            <p className="text-xs text-destructive bg-muted/50 rounded-md px-3 py-2">
              Error al cargar los colaboradores externos
            </p>
          ) : externalUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              No hay colaboradores externos activos en el sistema.
            </p>
          ) : filteredExternals.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center border rounded-md border-dashed">
              No se encontraron colaboradores que coincidan con &quot;{quoterSearch}&quot;
            </p>
          ) : (
            <div className="rounded-md border divide-y max-h-48 overflow-y-auto bg-card">
              {filteredExternals.map((u) => {
                const checked = quoterIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${disabled ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(val) => {
                        if (val) {
                          onQuoterIdsChange([...quoterIds, u.id]);
                        } else {
                          onQuoterIdsChange(quoterIds.filter((id) => id !== u.id));
                        }
                      }}
                      disabled={disabled}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{u.name}</span>
                      {u.area_name && (
                        <span className="text-xs text-muted-foreground ml-1.5">· {u.area_name}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{u.active_task_count} tarea(s)</span>
                  </label>
                );
              })}
            </div>
          )}
          {quoterIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quoterIds.map((id) => {
                const u = externalUsers.find((x) => x.id === id);
                if (!u) return null;
                return (
                  <Badge key={id} variant="secondary" className="text-xs gap-1">
                    {u.name}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => onQuoterIdsChange(quoterIds.filter((x) => x !== id))}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Info for commercial mode */}
      {assignMode === "commercial" && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          Esta tarea se asignará al comercial que cree el proyecto al momento de instanciarse.
        </p>
      )}

      {/* Info for requires_quote blocking */}
      {requiresQuote && (
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2">
          Con &quot;Requiere cotización&quot; activo, la asignación final la define el externo que gane la cotización.
          Los externos seleccionados arriba recibirán una invitación automáticamente al crear el proyecto.
        </p>
      )}
    </div>
  );
}
