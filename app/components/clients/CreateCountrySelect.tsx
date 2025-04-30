/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo } from "react";
import { ControllerRenderProps } from "react-hook-form";
import CreatableSelect from "react-select/creatable";
import { API_FLAG_CODE, API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";
import { Skeleton } from "../ui/skeleton";
import useGetItems from "@/hooks/useGetItems";
import useItemMutations from "@/hooks/useItemsMutation";
import { CountryType } from "@/lib/definitions";

// Importar los estilos de los selects
import "@/styles/selects.css";
import { toast } from "sonner";

interface CreateCountrySelectProps {
  field: ControllerRenderProps<
    { name: string; country_id: number },
    "country_id"
  >;
}

interface CountryOption {
  value: number;
  label: string;
  flag: string;
}

export function CreateCountrySelect({ field }: CreateCountrySelectProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryFlag, setNewCountryFlag] = useState("");
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  
  // Obtener los países usando el hook de consulta
  const { data, isLoading, isError } = useGetItems("/countries");
  console.log("data", data);
  const countries: CountryType[] = useMemo(() => data?.countries ?? [], [data]);
  
  // Preparar opciones para react-select
  useEffect(() => {
    if (countries && countries.length > 0) {
      const options = countries.map((country) => ({
        value: country.id as number,
        label: country.name,
        flag: country.flag,
      }));
      setCountryOptions(options);
    }
  }, [countries]);


  // Hook para crear un nuevo país
  const { createItem } = useItemMutations<CountryType>("/countries");

  // Manejar la creación de un nuevo país
  const handleCreateCountry = async (inputValue: string) => {
    setIsCreating(true);
    setNewCountryName(inputValue);
  };

  // Confirmar la creación del país
  const confirmCreateCountry = async () => {
    if (!newCountryName || !newCountryFlag) {
      toast.error("Por favor, completa todos los campos.");
      return;
    };
  
    try {
      const response = await createItem.mutateAsync({
        name: newCountryName,
        flag: newCountryFlag,
        id: 0,
      }) as CountryType;
      
      // Agregar el nuevo país a las opciones
      const newOption = {
        value: response.id as number,
        label: response.name,
        flag: response.flag,
      };
      
      setCountryOptions((prev) => [...prev, newOption]);
      
      // Seleccionar el país recién creado
      field.onChange(response.id);
      
      // Limpiar campos
      setNewCountryName("");
      setNewCountryFlag("");
      setIsCreating(false);
    } catch (error) {
      console.error("Error al crear el país:", error);
    }
  };

  // Formatear las opciones para mostrar la bandera junto al nombre
  const formatOptionLabel = (option: CountryOption) => (
    <div className="flex items-center gap-2">
      <span>{option.label}</span>
      <img
        src={`${API_FLAG_URL}${option.flag}${IMG_FLAG_EXT}`}
        alt=""
        width={16}
        height={12}
        className="inline-block"
      />
    </div>
  );

  // Cuando isCreating es true, mostrar campos adicionales para crear un país
  useEffect(() => {
    if (!isCreating) {
      setNewCountryName("");
      setNewCountryFlag("");
    }
  }, [isCreating]);

  if (isError) return <div className="text-red-500">Error al cargar los países</div>;

  // Si está creando un país, mostrar el formulario para completar la información
  if (isCreating) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newCountryName}
            onChange={(e) => setNewCountryName(e.target.value)}
            placeholder="Nombre del país"
            className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            autoFocus
          />
          <input
            type="text"
            value={newCountryFlag}
            onChange={(e) => setNewCountryFlag(e.target.value)}
            placeholder="Código de bandera"
            className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          />
        </div>
        <div>
          <p>
            Para obtener el código de la bandera, visita{" "}
            <a
              href={`${API_FLAG_CODE}s?q=${newCountryName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              AQUÍ
            </a>{" "}
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button 
            type="button"
            onClick={confirmCreateCountry}
            className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 h-9 rounded-md px-3 py-1 text-sm"
          >
            Guardar
          </button>
          <button 
            type="button"
            onClick={() => setIsCreating(false)} 
            className="bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 h-9 rounded-md px-3 py-1 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return isLoading ? (
    <Skeleton className="h-[36px]" />
  ) : (
    <CreatableSelect
      options={countryOptions}
      placeholder="Seleccione un país"
      value={countryOptions.find(option => option.value === field.value)}
      onChange={(selectedOption) => {
        field.onChange(selectedOption?.value);
      }}
      onCreateOption={handleCreateCountry}
      formatCreateLabel={(inputValue) => `Crear país "${inputValue}"`}
      formatOptionLabel={formatOptionLabel}
      className="react-select-container"
      classNamePrefix="react-select"
      loadingMessage={() => "Cargando países..."}
      noOptionsMessage={({ inputValue }) =>
        inputValue
          ? "No se encontraron países"
          : "Escribe para buscar países"
      }
    />
  );
}
