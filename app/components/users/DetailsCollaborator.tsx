"use client";

import { useState, KeyboardEvent } from "react";
import { toast } from "sonner";
import CheckboxChangeState from "../checkbox/CheckboxChangeState";
import AreaSelect from "./AreaSelect";
import { Input } from "../ui/input";
import { patch } from "@/lib/services/apiService";
import EnterSvg from "../icons/EnterSvg";
import { ColaboradorType } from "@/lib/definitions";

interface DetailsCollaboratorProps {
  user_id: number;
  is_internal: boolean;
  area_id: number;
  skills?: string[];
  monthly_salary?: number;
}

const DetailsCollaborator = ({
  user_id,
  is_internal,
  area_id,
  monthly_salary = 0,
}: DetailsCollaboratorProps) => {
  const [isInternal, setIsInternal] = useState<boolean>(is_internal);
  // Mantener un estado para el valor actual del salario después de actualizaciones
  const [currentSalary, setCurrentSalary] = useState<number>(monthly_salary);
  const [salary, setSalary] = useState<number | undefined>(monthly_salary);
  const [displaySalary, setDisplaySalary] = useState<string>(
    monthly_salary ? monthly_salary.toLocaleString("es-CO") : ""
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const formatNumberWithCommas = (value: string): string => {
    // Elimina todos los caracteres no numéricos
    const numericValue = value.replace(/[^0-9]/g, "");

    if (!numericValue) return "";

    // Convierte a número y formatea con separadores de miles
    const number = Number(numericValue);
    return isNaN(number) ? "" : number.toLocaleString("es-CO");
  };

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const cleanValue = inputValue.replace(/[^0-9]/g, "");

    // Actualiza el valor numérico para guardar
    setSalary(cleanValue ? Number(cleanValue) : undefined);

    // Actualiza el valor formateado para mostrar
    setDisplaySalary(formatNumberWithCommas(cleanValue));

    // Indica que el usuario está editando
    setIsEditing(cleanValue ? Number(cleanValue) !== currentSalary : false);
  };

  const updateSalary = async () => {
    if (salary === currentSalary || salary === undefined) return;

    setIsSaving(true);

    try {
      const promise = patch<ColaboradorType>(`users/${user_id}`, {
        monthly_salary: salary,
      });

      toast.promise(promise, {
        loading: "Actualizando salario...",
        success: (data) => {
          const res = data.data;
          // Actualizar el valor actual del salario después de una actualización exitosa
          if (salary !== undefined) {
            setCurrentSalary(res?.monthly_salary || 0);
          }
          setIsEditing(false);
          return "Salario actualizado correctamente";
        },
        error: (err) => {
          setSalary(currentSalary);
          setDisplaySalary(
            currentSalary ? currentSalary.toLocaleString("es-CO") : ""
          );
          return err instanceof Error
            ? err.message
            : "Error al actualizar el salario";
        },
      });
      // aqui esperamos a que la promesa se resuelva para que el finally se ejecute despues si no se coloca el setIsSaving(false) se ejecuta antes, y el input siempre estaria disponible
      await promise;
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      updateSalary();
    }
  };

  return (
    <div className="w-full">
      <CheckboxChangeState
        label="Colaborador interno"
        id="user-internal"
        initialChecked={is_internal}
        endpoint={`users/${user_id}`}
        fieldName="is_internal"
        onUpdate={(newValue) => setIsInternal(newValue)}
      />{" "}
      {isInternal && (
        <div className="mt-4">
          <label
            htmlFor="monthly-salary"
            className="text-sm font-medium mb-2 block"
          >
            Sueldo Mensual
          </label>
          <div className="relative">
            <span className="absolute md:text-xl left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              $
            </span>
            <Input
              id="monthly-salary"
              type="text"
              inputMode="numeric"
              placeholder="Ingresa el sueldo mensual"
              className="w-full pl-7 font-medium md:text-xl"
              value={displaySalary}
              onChange={handleSalaryChange}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
            />
            {isEditing && (
              <span
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 bg-gray-100 px-1 py-0.5 rounded text-xs font-medium flex items-center cursor-pointer hover:bg-gray-200 transition-colors"
                title="Presiona Enter para guardar"
              >
                <EnterSvg /> Enter
              </span>
            )}
          </div>
        </div>
      )}
      <AreaSelect
        initial_value={area_id}
        label="Área"
        placeholder="Selecciona o crea un área"
        required={false}
        disabled={false}
        onChange={(value) => console.log(value)}
        onBlur={() => console.log("blur")}
        className="mt-4"
        user_id={user_id}
      />
    </div>
  );
};

export default DetailsCollaborator;
