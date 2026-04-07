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
import { AreaType, UserRole } from "@/lib/definitions";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Users, Zap, UserCheck, X, Search } from "lucide-react";

export type AssignMode = "auto" | "commercial" | "specific";

const ROL_LABELS: Record<number, string> = {
  [UserRole.ADMIN]: "Admin",
  [UserRole.DIRECTIVO]: "Directivo",
  [UserRole.FINANCIERO]: "Financiero",
  [UserRole.COMERCIAL]: "Comercial",
  [UserRole.COLABORADOR]: "Colaborador",
};

const ROL_BADGE_CLASS: Record<number, string> = {
  [UserRole.ADMIN]: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
  [UserRole.DIRECTIVO]: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400",
  [UserRole.FINANCIERO]: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400",
  [UserRole.COMERCIAL]: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400",
  [UserRole.COLABORADOR]: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400",
};

interface UserOption {
  id: number;
  name: string;
  rol_id: number;
  is_internal: number;
  area_name: string | null;
  active_task_count: number;
}

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
  const { data: areasForAuto = [] } = useQuery<AreaType[]>({
    queryKey: ["areas-with-active-internals"],
    queryFn: async () => {
      const res = await get<{ data: AreaType[] }>("areas?with_active_internals=1");
      return res.ok ? ((res.data as unknown as { data: AreaType[] })?.data ?? []) : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: areasAll = [] } = useQuery<AreaType[]>({
    queryKey: ["areas-all"],
    queryFn: async () => {
      const res = await get<{ data: AreaType[] }>("areas");
      return res.ok ? ((res.data as unknown as { data: AreaType[] })?.data ?? []) : [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: assignMode === "specific",
  });

  const areas = assignMode === "auto" ? areasForAuto : areasAll;

  // External collaborators (for "requires_quote" quoter selection)
  const { data: externalUsers = [] } = useQuery<UserOption[]>({
    queryKey: ["external-collaborators-for-quote"],
    queryFn: async () => {
      const res = await get<UserOption[]>(`collaborators?only_external=1`);
      return res.ok ? (res.data ?? []) : [];
    },
    enabled: requiresQuote,
    staleTime: 1000 * 60 * 5,
  });

  // All active users (for "specific" mode), optionally filtered by area
  const { data: allUsers = [] } = useQuery<UserOption[]>({
    queryKey: ["all-users-for-assignment", areaId],
    queryFn: async () => {
      const params = new URLSearchParams({ all_users: "1" });
      if (areaId) params.set("area_id", areaId.toString());
      const res = await get<UserOption[]>(`collaborators?${params}`);
      return res.ok ? (res.data ?? []) : [];
    },
    enabled: assignMode === "specific",
    staleTime: 1000 * 60 * 2,
  });

  const { data: previewUser, isLoading: isLoadingPreview } = useQuery<{ id: number; name: string } | null>({
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
      return res.ok ? ((res.data as unknown as { data: { id: number; name: string } | null })?.data ?? null) : null;
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

  // Group users by role for the dropdown
  const admins = allUsers.filter((u) => u.rol_id === UserRole.ADMIN);
  const directivos = allUsers.filter((u) => u.rol_id === UserRole.DIRECTIVO);
  const financieros = allUsers.filter((u) => u.rol_id === UserRole.FINANCIERO);
  const comerciales = allUsers.filter((u) => u.rol_id === UserRole.COMERCIAL);
  const internals = allUsers.filter((u) => u.rol_id === UserRole.COLABORADOR && u.is_internal === 1);
  const externals = allUsers.filter((u) => u.rol_id === UserRole.COLABORADOR && u.is_internal === 0);

  const renderUserItem = (u: UserOption) => (
    <SelectItem key={u.id} value={u.id.toString()}>
      <div className="flex items-center justify-between gap-2 w-full">
        <span>{u.name}</span>
        <div className="flex items-center gap-1 ml-1">
          {u.rol_id === UserRole.COLABORADOR && (
            <span className="text-xs text-muted-foreground">
              {u.active_task_count} tarea(s)
            </span>
          )}
          {u.area_name && (
            <span className="text-xs text-muted-foreground">· {u.area_name}</span>
          )}
          {u.is_internal === 0 && u.rol_id === UserRole.COLABORADOR && (
            <span className="text-xs text-muted-foreground italic">(externo)</span>
          )}
        </div>
      </div>
    </SelectItem>
  );

  return (
    <div className="space-y-3">
      {/* Mode selector + area — hidden when requiresQuote (externals don't use internal assignment) */}
      {!requiresQuote && (
        <>
          <div>
            <label className="text-sm font-medium block mb-1.5">Asignación</label>
            <div className="grid grid-cols-1 gap-2">
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
                      ) : previewUser ? (
                        <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> Se asignará a: {previewUser.name}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive"><X className="h-3 w-3" /> Sin colaborador disponible</span>
                      )}
                    </div>
                  )}
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
                      ) : previewUser ? (
                        <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> Se asignará a: {previewUser.name}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive"><X className="h-3 w-3" /> Sin comercial asignado al proyecto</span>
                      )}
                    </div>
                  )}
                </div>
              </button>

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
            </div>
          </div>

          {/* Area selector — shown for auto and specific modes */}
          {(assignMode === "auto" || assignMode === "specific") && (
            <div>
              <label className="text-sm font-medium block mb-1.5">
                Área
                {assignMode === "auto" && <span className="text-destructive ml-1">*</span>}
                {assignMode === "specific" && <span className="text-muted-foreground text-xs ml-1">(opcional — filtra la lista)</span>}
              </label>
              <Select
                value={areaId?.toString() ?? "none"}
                onValueChange={(v) => {
                  onAreaIdChange(v === "none" ? null : Number(v));
                  onAssignedUserIdChange(null);
                }}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {assignMode === "specific" ? "Todas las áreas" : "Sin área específica"}
                  </SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area.id!} value={area.id!.toString()}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignMode === "auto" && !areaId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Si no seleccionas área, la auto-asignación no podrá ejecutarse.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* User selector — only for "specific" mode (never shown when requiresQuote) */}
      {assignMode === "specific" && !requiresQuote && (
        <div>
          <label className="text-sm font-medium block mb-1.5">Persona asignada</label>
          <Select
            value={assignedUserId?.toString() ?? "none"}
            onValueChange={(v) => onAssignedUserIdChange(v === "none" ? null : Number(v))}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar persona..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar (dejar vacío)</SelectItem>

              {admins.length > 0 && (
                <SelectGroup>
                  <SelectLabel>
                    <Badge variant="outline" className={`text-xs ${ROL_BADGE_CLASS[UserRole.ADMIN]}`}>
                      {ROL_LABELS[UserRole.ADMIN]}
                    </Badge>
                  </SelectLabel>
                  {admins.map(renderUserItem)}
                </SelectGroup>
              )}

              {directivos.length > 0 && (
                <>
                  {admins.length > 0 && <SelectSeparator />}
                  <SelectGroup>
                    <SelectLabel>
                      <Badge variant="outline" className={`text-xs ${ROL_BADGE_CLASS[UserRole.DIRECTIVO]}`}>
                        {ROL_LABELS[UserRole.DIRECTIVO]}
                      </Badge>
                    </SelectLabel>
                    {directivos.map(renderUserItem)}
                  </SelectGroup>
                </>
              )}

              {financieros.length > 0 && (
                <>
                  {(admins.length > 0 || directivos.length > 0) && <SelectSeparator />}
                  <SelectGroup>
                    <SelectLabel>
                      <Badge variant="outline" className={`text-xs ${ROL_BADGE_CLASS[UserRole.FINANCIERO]}`}>
                        {ROL_LABELS[UserRole.FINANCIERO]}
                      </Badge>
                    </SelectLabel>
                    {financieros.map(renderUserItem)}
                  </SelectGroup>
                </>
              )}

              {comerciales.length > 0 && (
                <>
                  {(admins.length > 0 || directivos.length > 0 || financieros.length > 0) && <SelectSeparator />}
                  <SelectGroup>
                    <SelectLabel>
                      <Badge variant="outline" className={`text-xs ${ROL_BADGE_CLASS[UserRole.COMERCIAL]}`}>
                        {ROL_LABELS[UserRole.COMERCIAL]}
                      </Badge>
                    </SelectLabel>
                    {comerciales.map(renderUserItem)}
                  </SelectGroup>
                </>
              )}

              {internals.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>
                      <Badge variant="outline" className={`text-xs ${ROL_BADGE_CLASS[UserRole.COLABORADOR]}`}>
                        Colaborador Interno
                      </Badge>
                    </SelectLabel>
                    {internals.map(renderUserItem)}
                  </SelectGroup>
                </>
              )}

              {externals.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>
                      <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                        Colaborador Externo
                      </Badge>
                    </SelectLabel>
                    {externals.map(renderUserItem)}
                  </SelectGroup>
                </>
              )}
            </SelectContent>
          </Select>
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

          {externalUsers.length === 0 ? (
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
