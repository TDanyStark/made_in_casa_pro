"use client";

import { useMemo, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/services/apiService";
import { ProductCategoryType } from "@/lib/definitions";
import { toast } from "sonner";

interface CategoryOption {
  value: number;
  label: string;
}

interface CategorySelectProps {
  value?: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CategorySelect({
  value,
  onChange,
  placeholder = "Selecciona o crea una categoría",
  disabled = false,
}: CategorySelectProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["product-categories-all"],
    queryFn: async () => {
      const res = await get<ProductCategoryType[]>("product-categories?all=true");
      return res.ok ? (res.data ?? []) : [];
    },
  });

  const options: CategoryOption[] = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );

  const handleCreate = async (inputValue: string) => {
    if (isCreating || !inputValue.trim()) return;
    setIsCreating(true);
    try {
      const res = await post<ProductCategoryType>("product-categories", {
        name: inputValue.trim(),
      });
      if (res.ok && res.data) {
        const newCat = res.data as ProductCategoryType;
        queryClient.setQueryData(
          ["product-categories-all"],
          (prev: ProductCategoryType[] = []) =>
            [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name))
        );
        onChange(newCat.id);
        toast.success(`Categoría "${newCat.name}" creada`);
      } else {
        toast.error("Error al crear la categoría");
      }
    } catch {
      toast.error("Error al crear la categoría");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <CreatableSelect
      instanceId="category-select"
      isLoading={isLoading || isCreating}
      options={options}
      placeholder={placeholder}
      value={options.find((o) => o.value === value) ?? null}
      onChange={(selected) => onChange(selected?.value ?? null)}
      onCreateOption={handleCreate}
      formatCreateLabel={(inputValue) => `Crear categoría "${inputValue}"`}
      isDisabled={disabled}
      isClearable
      classNamePrefix="react-select"
      loadingMessage={() => "Cargando categorías..."}
      noOptionsMessage={({ inputValue }) =>
        inputValue ? "No se encontraron categorías" : "Escribe para buscar o crear"
      }
    />
  );
}
