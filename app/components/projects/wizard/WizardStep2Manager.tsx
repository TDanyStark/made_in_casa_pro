"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "react-select";
import { get } from "@/lib/services/apiService";
import { ManagerType, ApiResponseWithPagination } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X, User, Mail } from "lucide-react";
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
  const [coManagers, setCoManagers] = useState<ManagerOption[]>(
    state.co_manager_ids.map((id, i) => ({
      value: id,
      label: state.co_manager_names[i] ?? "",
      email: state.co_manager_emails[i] ?? "",
    }))
  );

  // All managers except the main one and already-added co-managers
  const { data: allManagers = [], isLoading } = useQuery({
    queryKey: ["managers-all-for-comanager", state.manager_id],
    queryFn: async () => {
      const res = await get<ApiResponseWithPagination<ManagerType[]>>("managers?limit=200");
      if (!res.ok || !res.data) return [];
      const data = (res.data as unknown as { data: ManagerType[] }).data ?? [];
      return data
        .filter((m) => m.id !== state.manager_id)
        .map((m): ManagerOption => ({
          value: m.id!,
          label: m.name,
          email: m.email,
        }));
    },
    staleTime: 1000 * 60,
  });

  const availableOptions = allManagers.filter(
    (m) => !coManagers.find((cm) => cm.value === m.value)
  );

  const addCoManager = (opt: ManagerOption | null) => {
    if (!opt) return;
    setCoManagers((prev) => [...prev, opt]);
  };

  const removeCoManager = (id: number) => {
    setCoManagers((prev) => prev.filter((m) => m.value !== id));
  };

  const handleNext = () => {
    onNext({
      co_manager_ids: coManagers.map((m) => m.value),
      co_manager_names: coManagers.map((m) => m.label),
      co_manager_emails: coManagers.map((m) => m.email),
    });
  };

  return (
    <div className="space-y-6">
      {/* Main manager — read-only, auto-assigned from brand */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Gerente principal</label>
        <Card className="p-4 bg-muted/30 space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">{state.manager_name}</span>
            <Badge variant="secondary" className="text-xs ml-auto">
              Asignado por la marca
            </Badge>
          </div>
          {state.manager_email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              {state.manager_email}
            </div>
          )}
        </Card>
      </div>

      {/* Co-managers */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Co-responsables{" "}
          <span className="font-normal">(opcional)</span>
        </label>
        <Select<ManagerOption>
          instanceId="wizard-comanager-select"
          options={availableOptions}
          value={null}
          onChange={(opt) => addCoManager(opt as ManagerOption | null)}
          isLoading={isLoading}
          placeholder="Buscar gerente para agregar como co-responsable..."
          noOptionsMessage={() => "No hay gerentes disponibles"}
          formatOptionLabel={(opt: ManagerOption) => (
            <div>
              <p className="text-sm font-medium">{opt.label}</p>
              {opt.email && <p className="text-xs text-muted-foreground">{opt.email}</p>}
            </div>
          )}
          classNamePrefix="react-select"
          controlShouldRenderValue={false}
        />

        {coManagers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {coManagers.map((m) => (
              <Badge
                key={m.value}
                variant="secondary"
                className="flex items-center gap-1.5 pr-1"
              >
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
