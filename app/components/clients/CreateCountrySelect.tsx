/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef } from "react";
import { ControllerRenderProps } from "react-hook-form";
import useGetItems from "@/lib/hooks/useGetItems";
import { API_FLAG_URL, IMG_FLAG_EXT } from "@/variables";
import { Plus } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import useItemMutations from "@/lib/hooks/useItemsMutation";
import { CountryType } from "@/lib/definitions";

interface Country {
  id: string;
  name: string;
  flag: string;
}

interface CreateCountrySelectProps {
  field: ControllerRenderProps<
    { name: string; country_id: number },
    "country_id"
  >;
}

export function CreateCountrySelect({ field }: CreateCountrySelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryFlag, setNewCountryFlag] = useState("");
  const { data, isLoading, isError } = useGetItems("/countries");
  const countries: Country[] = data?.countries ?? [];
  const flagInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCountry = countries.find(
    (c) => String(c.id) === String(field.value)
  );

  // Enfoca el input de bandera al iniciar el modo de creación
  useEffect(() => {
    if (isCreating && flagInputRef.current) {
      setTimeout(() => {
        flagInputRef.current?.focus();
      }, 0);
    }
  }, [isCreating]);

  // Enfoca el input de búsqueda cuando se abre el dropdown
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, searchTerm, isCreating]);

  // Cierra el dropdown al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCountries = countries.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Si no hay coincidencias y se presiona Enter, activa el modo de creación
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchTerm && filteredCountries.length === 0) {
      e.preventDefault();
      setIsCreating(true);
      setNewCountryName(searchTerm);
    }
  };

  // llamar a useItemMutations
  const {createItem, dataCreate} = useItemMutations<CountryType>("/countries");

  const handleCreateCountry = () => {
    console.log(newCountryName, newCountryFlag);
    if (!newCountryName || !newCountryFlag) return;
    createItem.mutate({
      name: newCountryName,
      flag: newCountryFlag,
      id: 0,
    });
    console.log(dataCreate);
    setNewCountryName("");
    setNewCountryFlag("");
    setIsCreating(false);
  };

  if (isError)
    return <div className="text-red-500">Error al cargar los países</div>;

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      {isLoading ? (
        <div className="h-9 w-full mb-2 bg-gray-200 animate-pulse rounded" />
      ) : (
        <div>
          {/* Trigger del "select" personalizado */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full border border-gray-300 p-2 rounded text-left"
          >
            {selectedCountry ? (
              <div className="flex items-center gap-2">
                {selectedCountry.name}
                <img
                  src={`${API_FLAG_URL}${selectedCountry.flag}${IMG_FLAG_EXT}`}
                  alt={selectedCountry.name}
                  width="20"
                  height="15"
                  className="mr-2"
                />
              </div>
            ) : ("Seleccione un país")}
          </button>
          {/* Dropdown */}
          {isOpen && !isCreating && (
            <div className="absolute z-10 bg-background mt-1 w-full rounded shadow">
              <div className="p-2">
                <Input
                  type="text"
                  placeholder="Buscar país..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  ref={searchInputRef}
                  className="w-full p-2 border border-gray-300 rounded mb-2"
                />
                <ul className="max-h-60 overflow-auto">
                  {filteredCountries.map((country) => (
                    <li
                      key={country.id}
                      onClick={() => {
                        field.onChange(country.id);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                      className="p-2 hover:bg-secondary flex items-center gap-2 cursor-pointer rounded"
                    >
                      {country.name}
                      <img
                        src={`${API_FLAG_URL}${country.flag}${IMG_FLAG_EXT}`}
                        alt={country.name}
                        width="20"
                        height="15"
                      />
                    </li>
                  ))}
                  {filteredCountries.length === 0 && searchTerm && !isCreating && (
                    <li className="p-2 text-sm text-gray-500">
                      Presione Enter para crear &quot;{searchTerm}&quot;
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sección para crear un nuevo país */}
      {isCreating && (
        <div className="flex items-center gap-2 mt-2">
          <Input
            type="text"
            value={newCountryName}
            onChange={(e) => setNewCountryName(e.target.value)}
            placeholder="Nombre del nuevo país"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <Input
            type="text"
            ref={flagInputRef}
            value={newCountryFlag}
            onChange={(e) => setNewCountryFlag(e.target.value)}
            placeholder="Bandera"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <Button
            onClick={handleCreateCountry}
          >
            <Plus className="w-4 h-4 mr-1" />
            Crear
          </Button>
          <Button
            onClick={() => setIsCreating(false)}
            variant={"secondary"}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
