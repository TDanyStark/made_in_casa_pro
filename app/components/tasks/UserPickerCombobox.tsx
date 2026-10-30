"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { UserRole } from "@/lib/definitions";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

/** Active user as returned by `GET /api/collaborators?all_users=1`. */
export interface AssignableUserOption {
  id: number;
  name: string;
  rol_id: number;
  is_internal: number;
  area_name: string | null;
  active_task_count: number;
}

const ROL_LABELS: Record<number, string> = {
  [UserRole.ADMIN]: "Admin",
  [UserRole.DIRECTIVO]: "Directivo",
  [UserRole.FINANCIERO]: "Financiero",
  [UserRole.COMERCIAL]: "Comercial",
  [UserRole.COLABORADOR]: "Colaborador",
};

const NO_AREA_LABEL = "Sin área";
const UNASSIGNED_LABEL = "Sin asignar";

export const isCollaborator = (u: AssignableUserOption) => u.rol_id === UserRole.COLABORADOR;

/** Every active user, for free assignment. Shared cache across task forms and tables. */
export function useAssignableCollaborators(enabled = true) {
  return useQuery<AssignableUserOption[]>({
    queryKey: ["all-users-for-assignment"],
    queryFn: async () => {
      const res = await get<AssignableUserOption[]>(`collaborators?all_users=1`);
      if (!res.ok) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

/** Groups users by area ("Sin área" last); inside each area internals first, then by name. */
export function groupUsersByArea(users: AssignableUserOption[]) {
  const groups = new Map<string, AssignableUserOption[]>();
  for (const u of users) {
    const key = u.area_name ?? NO_AREA_LABEL;
    const list = groups.get(key) ?? [];
    list.push(u);
    groups.set(key, list);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === NO_AREA_LABEL) return 1;
    if (b === NO_AREA_LABEL) return -1;
    return a.localeCompare(b);
  });
  return sortedKeys.map((area) => ({
    area,
    users: groups
      .get(area)!
      .slice()
      .sort((a, b) => {
        if (a.is_internal !== b.is_internal) return b.is_internal - a.is_internal;
        return a.name.localeCompare(b.name);
      }),
  }));
}

function InternalBadge({ user }: { user: AssignableUserOption }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] px-1 py-0",
        user.is_internal === 1
          ? "text-green-700 border-green-300 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
          : "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400"
      )}
    >
      {user.is_internal === 1 ? "Interno" : "Externo"}
    </Badge>
  );
}

interface UserPickerComboboxProps {
  users: AssignableUserOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Adds a "Sin asignar" option that selects `null`. */
  allowUnassigned?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Searchable person picker grouped by area, showing internal/external and the
 * active task count of each collaborator.
 */
export function UserPickerCombobox({
  users,
  value,
  onChange,
  allowUnassigned = false,
  disabled = false,
  placeholder = "Seleccionar persona...",
}: UserPickerComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedUser = users.find((u) => u.id === value) ?? null;
  const usersByArea = groupUsersByArea(users);

  const select = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedUser ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{selectedUser.name}</span>
              {selectedUser.area_name && (
                <span className="truncate text-xs text-muted-foreground">· {selectedUser.area_name}</span>
              )}
              {isCollaborator(selectedUser) && <InternalBadge user={selectedUser} />}
            </span>
          ) : allowUnassigned && value === null ? (
            <span>{UNASSIGNED_LABEL}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,90vw)] min-w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Buscar por nombre, área, interno/externo..." />
          <CommandList>
            <CommandEmpty>No se encontraron personas.</CommandEmpty>
            {allowUnassigned && (
              <CommandGroup>
                <CommandItem value={UNASSIGNED_LABEL} onSelect={() => select(null)}>
                  <Check className={cn("mr-2 h-4 w-4", value === null ? "opacity-100" : "opacity-0")} />
                  {UNASSIGNED_LABEL}
                </CommandItem>
              </CommandGroup>
            )}
            {usersByArea.map(({ area, users: areaUsers }) => (
              <CommandGroup key={area} heading={area}>
                {areaUsers.map((u) => {
                  const internalLabel = isCollaborator(u) ? (u.is_internal === 1 ? "interno" : "externo") : "";
                  return (
                    <CommandItem
                      key={u.id}
                      value={`${u.name} ${area} ${internalLabel}`}
                      onSelect={() => select(u.id)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === u.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex items-center justify-between gap-2 w-full min-w-0">
                        <span className="truncate">{u.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isCollaborator(u) ? (
                            <>
                              <span className="text-xs text-muted-foreground">{u.active_task_count} tarea(s)</span>
                              <InternalBadge user={u} />
                            </>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {ROL_LABELS[u.rol_id] ?? "—"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
