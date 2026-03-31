"use client";

import { useState } from "react";
import { CampaignSelect } from "@/components/projects/CampaignSelect";
import { Button } from "@/components/ui/button";
import { WizardState } from "@/hooks/useProjectWizard";
import { Tag } from "lucide-react";

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
}

export function WizardStep5Campaign({ state, onNext, onBack }: Props) {
  const [campaignId, setCampaignId] = useState<number | null>(state.campaign_id ?? null);
  const [campaignName, setCampaignName] = useState<string>(state.campaign_name ?? "");

  const handleChange = (id: number | null, name?: string) => {
    setCampaignId(id);
    setCampaignName(name ?? "");
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
          value={campaignId}
          initialLabel={campaignName || null}
          clientId={state.client_id}
          onChange={handleChange}
          placeholder="Buscar campaña existente o crear nueva..."
        />
      </div>

      {campaignName && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
          Campaña seleccionada:{" "}
          <span className="font-semibold">{campaignName}</span>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button
          type="button"
          onClick={() => onNext({ campaign_id: campaignId, campaign_name: campaignName })}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
