"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { post } from "@/lib/services/apiService";
import type { ProjectCostCategoryType } from "@/lib/definitions";
import { COST_CATEGORIES_KEY } from "@/hooks/useProjectCosts";
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
import { cn } from "@/lib/utils";

// Spec: odd/tasks/project-costs.md — S6: searchable select that creates a missing category inline.

export type CostCategoryOption = Pick<ProjectCostCategoryType, "id" | "name">;

interface Props {
  id?: string;
  categories: CostCategoryOption[];
  value: CostCategoryOption | null;
  onChange: (category: CostCategoryOption) => void;
  disabled?: boolean;
}

export function CostCategoryCombobox({ id, categories, value, onChange, disabled = false }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const typed = search.trim();
  const exactMatch = categories.some((c) => c.name.toLowerCase() === typed.toLowerCase());
  const canCreate = typed !== "" && !exactMatch;

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  const select = (category: CostCategoryOption) => {
    onChange(category);
    close();
  };

  const create = async () => {
    setCreating(true);
    try {
      // 201 when created, 200 with the existing one when another user created it meanwhile.
      const res = await post<ProjectCostCategoryType>("project-cost-categories", { name: typed });
      if (!res.ok || !res.data) throw new Error(res.error || "Error al crear la categoría");
      await queryClient.invalidateQueries({ queryKey: COST_CATEGORIES_KEY });
      select({ id: res.data.id, name: res.data.name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear la categoría");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label="Categoría"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {value ? (
            <span className="truncate">{value.name}</span>
          ) : (
            <span className="text-muted-foreground">Seleccionar categoría...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,90vw)] min-w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, query) => (itemValue.toLowerCase().includes(query.trim().toLowerCase()) ? 1 : 0)}
        >
          <CommandInput
            placeholder="Buscar o crear categoría..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {/* Only reachable with no categories at all: any typed text offers "Crear". */}
            {!canCreate && <CommandEmpty>Escribe un nombre para crear la primera categoría.</CommandEmpty>}
            <CommandGroup>
              {categories.map((c) => (
                <CommandItem key={c.id} value={c.name} onSelect={() => select(c)}>
                  <Check className={cn("mr-2 h-4 w-4", value?.id === c.id ? "opacity-100" : "opacity-0")} />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && (
              // forceMount: cmdk would hide the group when no existing category matches.
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={`__create__ ${typed}`}
                  disabled={creating}
                  onSelect={create}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {`Crear «${typed}»`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
