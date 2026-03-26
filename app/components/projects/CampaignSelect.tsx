"use client";

import { useMemo, useState } from "react";
import AsyncCreatableSelect from "react-select/async-creatable";
import { get, post } from "@/lib/services/apiService";
import { CampaignType, ApiResponseWithPagination } from "@/lib/definitions";

interface CampaignOption {
  value: number;
  label: string;
}

interface CampaignSelectProps {
  value?: number | null;
  onChange: (id: number | null, name?: string) => void;
  placeholder?: string;
  isClearable?: boolean;
}

export function CampaignSelect({
  value,
  onChange,
  placeholder = "Buscar o crear campaña...",
  isClearable = true,
}: CampaignSelectProps) {
  const [selectedOption, setSelectedOption] = useState<CampaignOption | null>(null);

  const loadOptions = async (inputValue: string): Promise<CampaignOption[]> => {
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (inputValue.trim()) params.set("search", inputValue);
      const res = await get<ApiResponseWithPagination<CampaignType[]>>(`campaigns?${params}`);
      if (!res.ok || !res.data) return [];
      const campaigns = (res.data as unknown as { data: CampaignType[] }).data ?? [];
      return campaigns.map((c) => ({ value: c.id, label: c.name }));
    } catch {
      return [];
    }
  };

  const handleCreate = async (inputValue: string) => {
    try {
      const res = await post<CampaignType>("campaigns", { name: inputValue });
      if (!res.ok || !res.data) return;
      const campaign = res.data as unknown as CampaignType;
      const option = { value: campaign.id, label: campaign.name };
      setSelectedOption(option);
      onChange(campaign.id, campaign.name);
    } catch {
      console.error("Error creating campaign");
    }
  };

  const currentValue = useMemo(() => {
    if (selectedOption && selectedOption.value === value) return selectedOption;
    if (value && selectedOption?.value !== value) return selectedOption;
    return null;
  }, [value, selectedOption]);

  return (
    <AsyncCreatableSelect<CampaignOption>
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      onCreateOption={handleCreate}
      value={currentValue}
      onChange={(option) => {
        setSelectedOption(option as CampaignOption | null);
        onChange(option ? (option as CampaignOption).value : null, option?.label);
      }}
      placeholder={placeholder}
      isClearable={isClearable}
      formatCreateLabel={(inputValue) => `Crear campaña "${inputValue}"`}
      noOptionsMessage={({ inputValue }) =>
        inputValue ? "No se encontraron campañas" : "Escribe para buscar"
      }
      loadingMessage={() => "Buscando campañas..."}
      classNamePrefix="react-select"
    />
  );
}

export default CampaignSelect;
