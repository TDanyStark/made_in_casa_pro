"use client";

import { useState } from "react";
import AsyncCreatableSelect from "react-select/async-creatable";
import { get, post } from "@/lib/services/apiService";
import { CampaignType, ApiResponseWithPagination } from "@/lib/definitions";

interface CampaignOption {
  value: number;
  label: string;
}

interface CampaignSelectProps {
  /** Currently selected campaign id */
  value?: number | null;
  /** Label for the currently selected campaign (avoids an extra fetch on mount) */
  initialLabel?: string | null;
  /** Client id to scope the campaigns list — only shows campaigns of this client */
  clientId?: number | null;
  onChange: (id: number | null, name?: string) => void;
  placeholder?: string;
  isClearable?: boolean;
}

export function CampaignSelect({
  value,
  initialLabel,
  clientId,
  onChange,
  placeholder = "Buscar o crear campaña...",
  isClearable = true,
}: CampaignSelectProps) {
  // Initialise with the known value+label so the select shows the current value on mount
  const [selectedOption, setSelectedOption] = useState<CampaignOption | null>(() => {
    if (value && initialLabel) return { value, label: initialLabel };
    return null;
  });

  const loadOptions = async (inputValue: string): Promise<CampaignOption[]> => {
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (inputValue.trim()) params.set("search", inputValue);
      // Always filter by client when clientId is provided
      if (clientId) params.set("client_id", clientId.toString());

      const res = await get<ApiResponseWithPagination<CampaignType[]>>(`campaigns?${params}`);
      if (!res.ok || !res.data) return [];
      const campaigns = (res.data as unknown as { data: CampaignType[] }).data ?? [];
      return campaigns.map((c) => ({ value: c.id, label: c.name }));
    } catch {
      return [];
    }
  };

  const handleCreate = async (inputValue: string) => {
    if (!clientId) {
      console.warn("CampaignSelect: clientId is required to create a campaign");
      return;
    }
    try {
      const res = await post<CampaignType>("campaigns", {
        name: inputValue,
        client_id: clientId,
      });
      if (!res.ok || !res.data) return;
      const campaign = res.data as unknown as CampaignType;
      const option = { value: campaign.id, label: campaign.name };
      setSelectedOption(option);
      onChange(campaign.id, campaign.name);
    } catch {
      console.error("Error creating campaign");
    }
  };

  return (
    <AsyncCreatableSelect<CampaignOption>
      // Re-mount when clientId changes so the options list refreshes
      key={clientId ?? "no-client"}
      cacheOptions={false}
      defaultOptions
      loadOptions={loadOptions}
      onCreateOption={handleCreate}
      value={selectedOption}
      onChange={(option) => {
        const opt = option as CampaignOption | null;
        setSelectedOption(opt);
        onChange(opt ? opt.value : null, opt?.label);
      }}
      placeholder={placeholder}
      isClearable={isClearable}
      isDisabled={!clientId}
      formatCreateLabel={(inputValue) => `Crear campaña "${inputValue}"`}
      noOptionsMessage={({ inputValue }) =>
        !clientId
          ? "Selecciona una marca primero"
          : inputValue
          ? "No se encontraron campañas"
          : "Escribe para buscar o crear"
      }
      loadingMessage={() => "Buscando campañas..."}
      classNamePrefix="react-select"
    />
  );
}

export default CampaignSelect;
