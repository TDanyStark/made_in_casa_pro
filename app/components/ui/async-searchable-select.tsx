"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { get } from "@/lib/services/apiService";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type AsyncItem = { id?: number | string };

interface AsyncSearchableSelectProps<T extends AsyncItem> {
  /** Endpoint paginado de la API (p. ej. "brands"); recibe `search` y los `params`. */
  endpoint: string;
  /** Parámetros extra de la consulta (p. ej. `{ client_id }`); los vacíos se omiten. */
  params?: Record<string, string | undefined>;
  /** Texto visible de cada fila devuelta por el endpoint. */
  getLabel: (item: T) => string;
  value: string;
  onValueChange: (value: string) => void;
  /** Primera opción fija, p. ej. `{ value: "all", label: "Marca: todas" }`. */
  allOption: { value: string; label: string };
  /** Etiqueta conocida por el padre para un `value` que aún no se ha cargado. */
  selectedLabel?: string;
  /** Resuelve la etiqueta de un `value` desconocido (p. ej. id que viene en la URL). */
  fetchSelectedLabel?: (value: string) => Promise<string | undefined>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
  className?: string;
}

/**
 * Select con búsqueda del lado del servidor: carga la primera página del endpoint
 * al abrirse y vuelve a consultar con el término de búsqueda (con debounce).
 * Mismo aspecto que `SearchableSelect`, pero sin precargar listas grandes.
 */
export function AsyncSearchableSelect<T extends AsyncItem>({
  endpoint,
  params,
  getLabel,
  value,
  onValueChange,
  allOption,
  selectedLabel,
  fetchSelectedLabel,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados.",
  errorMessage = "Error al cargar las opciones.",
  loadingMessage = "Cargando...",
  className,
}: AsyncSearchableSelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  // Etiqueta de la última opción elegida: sigue visible aunque salga de la página cargada.
  const [captured, setCaptured] = React.useState<{ value: string; label: string } | null>(null);
  const { searchTerm, handleInputChange, resetSearch } = useDebouncedSearch();

  const query = new URLSearchParams();
  if (searchTerm) query.set("search", searchTerm);
  Object.entries(params ?? {}).forEach(([key, val]) => {
    if (val) query.set(key, val);
  });
  const qs = query.toString();
  const url = qs ? `${endpoint}?${qs}` : endpoint;

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["async-searchable-select", url],
    queryFn: async () => {
      const res = await get<{ data: T[] }>(url);
      if (!res.ok) throw new Error(res.error);
      return res.data?.data ?? [];
    },
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });

  const options = items.map((item) => ({ value: String(item.id), label: getLabel(item) }));

  const isAll = value === allOption.value;
  const knownLabel = isAll
    ? allOption.label
    : captured?.value === value
      ? captured.label
      : options.find((opt) => opt.value === value)?.label;

  const { data: fetchedLabel } = useQuery({
    queryKey: ["async-searchable-select-label", endpoint, value],
    queryFn: () => fetchSelectedLabel!(value),
    enabled: Boolean(value && !knownLabel && fetchSelectedLabel),
    staleTime: 1000 * 60 * 5,
  });

  const triggerLabel = knownLabel ?? fetchedLabel ?? selectedLabel;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setInputValue("");
      resetSearch();
    }
  };

  const select = (opt: { value: string; label: string }) => {
    setCaptured(opt);
    onValueChange(opt.value);
    handleOpenChange(false);
  };

  const statusMessage = isError
    ? errorMessage
    : isLoading
      ? loadingMessage
      : options.length === 0
        ? emptyMessage
        : null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !triggerLabel && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{triggerLabel ?? placeholder}</span>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={(v) => {
              setInputValue(v);
              handleInputChange(v);
            }}
          />
          <CommandList>
            <CommandGroup>
              {[allOption, ...options].map((opt) => (
                <CommandItem key={opt.value} value={opt.value} onSelect={() => select(opt)}>
                  <CheckIcon
                    className={cn("size-4 shrink-0", value === opt.value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex-1 truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {statusMessage && (
              <p className="py-6 text-center text-sm text-muted-foreground">{statusMessage}</p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
