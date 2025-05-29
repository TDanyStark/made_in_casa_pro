"use client";

import { useEffect, useMemo, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { debounce } from "lodash";
import { useGetEndpointQueryClient } from "@/hooks/useGetEndpointQueryClient";
import { post } from "@/lib/services/apiService";
import { SkillType } from "@/lib/definitions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SkillOption {
  value: number;
  label: string;
}

interface SkillSelectProps {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  user_id: number;
  onSkillAdded?: (skill: SkillType) => void;
}

const SkillSelect = ({
  placeholder = "Selecciona o crea una habilidad",
  disabled = false,
  className,
  label,
  user_id,
  onSkillAdded
}: SkillSelectProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);
  const [isCreatingSkill, setIsCreatingSkill] = useState(false);

  const { data, isLoading: isLoadingSkills } =
    useGetEndpointQueryClient<SkillType>({
      search: searchTerm,
      endpoint: "skills",
    });

  const skills = useMemo(() => data?.data || [], [data]);

  const queryClient = useQueryClient();

  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  const handleInputChange = (inputValue: string) => {
    if (inputValue.trim()) {
      debouncedSearch(inputValue);
    }
  };

  useEffect(() => {
    if (skills && skills.length > 0) {
      const options = skills.map((skill: SkillType) => ({
        value: skill.id,
        label: skill.name,
      }));
      setSkillOptions(options);
    }
  }, [skills]);

  const handleCreateSkill = async (inputValue: string) => {
    if (isCreatingSkill || !inputValue.trim()) return;

    setIsCreatingSkill(true);

    try {
      // Call the API endpoint to create a new skill
      const response = await post<SkillType>("skills", {
        name: inputValue.trim(),
      });

      if (response.ok && response.data) {
        // Add the new skill to the options
        const newOption = {
          value: response.data.id,
          label: response.data.name,
        };

        setSkillOptions((prev) => [...prev, newOption]);

        // Add the skill to the user
        await addSkillToUser(response.data);
      } else {
        console.error("Error creating skill:", response.error);
        toast.error("Error al crear la habilidad");
      }
    } catch (error) {
      console.error("Error creating skill:", error);
      toast.error("Error al crear la habilidad");
    } finally {
      // limpiar el campo de búsqueda
      setSearchTerm("");
      setIsCreatingSkill(false);
    }
  };

  const handleSelectSkill = async (selectedOption: SkillOption | null) => {
    if (!selectedOption) return;
    
    try {
      const skill: SkillType = {
        id: selectedOption.value,
        name: selectedOption.label
      };
      
      await addSkillToUser(skill);
    } catch (error) {
      console.error("Error selecting skill:", error);
      toast.error("Error al seleccionar la habilidad");
    }
  };

  const addSkillToUser = async (skill: SkillType) => {
    try {
      const response = await post(`users/${user_id}/skills`, {
        skill_id: skill.id
      });

      if (response.ok) {
        toast.success(`Habilidad "${skill.name}" añadida correctamente`);

        // Invalidate the user skills query to refresh the data
        queryClient.invalidateQueries({
          queryKey: ["skills"],
        });
        
          // Call the callback if provided
        if (onSkillAdded) {
          onSkillAdded(skill);
        }
      } else {
        console.error("Error adding skill to user:", response.error);
        toast.error("Error al añadir la habilidad al usuario");
      }
    } catch (error) {
      console.error("Error adding skill to user:", error);
      toast.error("Error al añadir la habilidad al usuario");
    }
  };

  const handleResetSearch = () => {
    setSearchTerm("");
  };

  return (
    <div className={className}>
      {label && (
        <label className="text-sm font-medium mb-2 block">
          {label}
        </label>
      )}
      <CreatableSelect
        isLoading={isLoadingSkills || isCreatingSkill}
        options={skillOptions}
        placeholder={placeholder}
        value={null} // Always keep it empty, as we're using it to add skills
        onChange={(selectedOption) => handleSelectSkill(selectedOption as SkillOption)}
        onInputChange={handleInputChange}
        onCreateOption={handleCreateSkill}
        onBlur={handleResetSearch}
        formatCreateLabel={(inputValue) => `Crear habilidad "${inputValue}"`}
        isDisabled={disabled}
        classNamePrefix="react-select"
        loadingMessage={() => "Cargando habilidades..."}
        noOptionsMessage={({ inputValue }) =>
          inputValue ? "No se encontraron habilidades" : "Escribe para buscar habilidades"
        }
        isClearable
      />
    </div>
  );
};

export default SkillSelect;
