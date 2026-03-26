"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "react-select";
import { get } from "@/lib/services/apiService";
import { ManagerType, ApiResponseWithPagination } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { WizardState } from "@/hooks/useProjectWizard";

interface ManagerOption {
  value: number;
  label: string;
  email: string;
}

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
}

export function WizardStep2Manager({ state, onNext, onBack }: Props) {
  const [selectedManager, setSelectedManager] = useState<ManagerOption | null>(
    state.manager_id ? { value: state.manager_id, label: state.manager_name, email: "" } : null
  );
  const [coManagers, setCoManagers] = useState<ManagerOption[]>(
    state.co_manager_ids.map((id, i) => ({
      value: id,
      label: state.co_manager_names[i] ?? "",
      email: "",
    }))
  );
  const [error, setError] = useState("");

  // Fetch managers for the selected brand
  const { data: managers = [], isLoading } = useQuery({
    queryKey: ["managers-for-brand", state.brand_id],
    queryFn: async () => {
      if (!state.brand_id) return [];
      const res = await get<ApiResponseWithPagination<ManagerType[]>>(
        `managers?limit=100&brand_id=${state.brand_id}`
      );
      if (!res.ok || !res.data) return [];
      const data = (res.data as unknown as { data: ManagerType[] }).data ?? [];
      return data.map((m): ManagerOption => ({
        value: m.id!,
        label: m.name,
        email: m.email,
      }));
    },
    staleTime: 1000 * 60,
  });

  const handleNext = () => {
    if (!selectedManager) {
      setError("El gerente principal es requerido");
      return;
    }
    setError("");
    onNext({
      manager_id: selectedManager.value,
      manager_name: selectedManager.label,
      co_manager_ids: coManagers.map((m) => m.value),
      co_manager_names: coManagers.map((m) => m.label),
    });
  };

  const addCoManager = (opt: ManagerOption | null) => {
    if (!opt) return;
    if (opt.value === selectedManager?.value) return;
    if (coManagers.find((m) => m.value === opt.value)) return;
    setCoManagers((prev) => [...prev, opt]);
  };

  const removeCoManager = (id: number) => {
    setCoManagers((prev) => prev.filter((m) => m.value !== id));
  };

  // Available managers filtered out already-selected co-managers and main manager
  const availableForCoManager = managers.filter(
    (m) =>
      m.value !== selectedManager?.value &&
      !coManagers.find((cm) => cm.value === m.value)
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Gerente principal *</label>
        <Select<ManagerOption>
          options={managers}
          value={selectedManager}
          onChange={(opt) => {
            setSelectedManager(opt as ManagerOption | null);
            setError("");
          }}
          isLoading={isLoading}
          placeholder="Seleccionar gerente..."
          noOptionsMessage={() =>
            isLoading ? "Cargando..." : "No hay gerentes disponibles para esta marca"
          }
          formatOptionLabel={(opt: ManagerOption) => (
            <div>
              <p className="text-sm font-medium">{opt.label}</p>
              {opt.email && <p className="text-xs text-muted-foreground">{opt.email}</p>}
            </div>
          )}
          classNamePrefix="react-select"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Co-responsables (opcional)
        </label>
        <Select<ManagerOption>
          options={availableForCoManager}
          value={null}
          onChange={(opt) => addCoManager(opt as ManagerOption | null)}
          isDisabled={!selectedManager}
          placeholder={
            selectedManager
              ? "Agregar co-responsable..."
              : "Primero selecciona el gerente principal"
          }
          classNamePrefix="react-select"
          controlShouldRenderValue={false}
        />
        {coManagers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {coManagers.map((m) => (
              <Badge key={m.value} variant="secondary" className="flex items-center gap-1.5 pr-1">
                {m.label}
                <button
                  type="button"
                  onClick={() => removeCoManager(m.value)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
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
