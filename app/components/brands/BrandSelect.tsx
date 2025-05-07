"use client";

import { useEffect, useMemo, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { debounce } from "lodash";
import { useGetEndpointQuery } from "@/hooks/useGetEndpointQuery";
import { 
  FormControl, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Control, UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/ui/form";
import CreateBrandModal from "../clients/CreateBrandModal";
import { BrandsAndManagersType, BrandType } from "@/lib/definitions";
import { FormDataTest } from "../projects/ClientComponent";

interface BrandOption {
  value: number;
  label: string;
  managerId?: number;
  managerName?: string;
}

interface FormData {
  brand_id: number;
  name: string;
  id?: number;
}

interface BrandSelectProps {
  form: UseFormReturn<FormDataTest>; 
  control: Control<FormData>;
  name: "name" | "brand_id" | "id";
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: number | undefined) => void;
}

export function BrandSelect({
  form,
  control,
  name,
  label = "Marca",
  placeholder = "Selecciona o crea una marca",
  required = false,
  disabled = false,
  onChange,
}: BrandSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState<string>("");

  const { data, isLoading: isLoadingBrands } = useGetEndpointQuery<BrandsAndManagersType>({
    search: searchTerm,
    endpoint: "brands",
  });

  const brands = useMemo(() => data?.data || [], [data]);

  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  const handleInputChange = (inputValue: string) => {
    if (inputValue.trim()) {
      debouncedSearch(inputValue);
    }
  };

  const handleResetSearch = () => {
    setSearchTerm("");
  };

  useEffect(() => {
    if (brands) {
      const options = brands.map((brand: BrandsAndManagersType) => ({
        value: brand.id as number,
        label: brand.brand_name,
        managerId: brand.manager_id,
        managerName: brand.manager_name,
      }));
      setBrandOptions(options);
    }
  }, [brands]);

  const handleCreateBrand = (inputValue: string) => {
    setIsCreatingBrand(true);
    setNewBrandName(inputValue);
  };

  const handleBrandCreated = (newBrand: BrandType) => {
    // Add the new brand to the options
    const newOption = {
      value: newBrand.id as number,
      label: newBrand.name,
    };
    setBrandOptions((prevOptions) => [...prevOptions, newOption]);

    // Select the newly created manager and notify parent
    if (onChange) {
      onChange(newBrand.id as number);
    }

    form.setValue(name, newBrand.id as number);

    setIsCreatingBrand(false);
  }

  const filterOption = () => true;

  // Custom format for option labels to display manager info if available
  const formatOptionLabel = (option: BrandOption) => (
    <div className="flex items-center justify-between gap-2">
      <span>{option.label}</span>
      {option.managerName && (
        <span className="text-xs text-muted-foreground">
          {option.managerName}
        </span>
      )}
    </div>
  );

  return (
    <>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <CreatableSelect
                isLoading={isLoadingBrands}
                options={brandOptions}
                placeholder={placeholder}
                required={required}
                value={brandOptions.find(
                  (option) => option.value === field.value
                )}
                onChange={(selectedOption) => {
                  field.onChange(selectedOption?.value);
                  if (onChange) onChange(selectedOption?.value);
                }}
                onInputChange={handleInputChange}
                onBlur={handleResetSearch}
                onCreateOption={handleCreateBrand}
                formatCreateLabel={(inputValue) =>
                  `Crear marca "${inputValue}"`
                }
                formatOptionLabel={formatOptionLabel}
                filterOption={filterOption}
                isDisabled={disabled}
                classNamePrefix="react-select"
                loadingMessage={() => "Cargando marcas..."}
                noOptionsMessage={({ inputValue }) =>
                  inputValue
                    ? "No se encontraron marcas"
                    : "Escribe para buscar marcas"
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <CreateBrandModal
        openModal={isCreatingBrand}
        initialName={newBrandName}
        handleModal={(state) => setIsCreatingBrand(state)}
        onSuccess={handleBrandCreated}
      />
    </>
  );
}

export default BrandSelect;