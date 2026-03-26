"use client";

import { CampaignSelect } from "@/components/projects/CampaignSelect";
import { Button } from "@/components/ui/button";
import { WizardState } from "@/hooks/useProjectWizard";
import { Tag } from "lucide-react";

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
}

export function WizardStep4Campaign({ state, onNext, onBack }: Props) {
  const handleChange = (id: number | null, name?: string) => {
    onNext({ campaign_id: id, campaign_name: name ?? "" });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Campaña asociada{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Asocia este proyecto a una campaña para agrupar múltiples proyectos en tus informes.
        </p>
        <CampaignSelect
          value={state.campaign_id}
          onChange={handleChange}
          placeholder="Buscar campaña existente o crear nueva..."
        />
      </div>

      {state.campaign_name && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
          Campaña seleccionada:{" "}
          <span className="font-semibold">{state.campaign_name}</span>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button type="button" onClick={() => onNext({})}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
