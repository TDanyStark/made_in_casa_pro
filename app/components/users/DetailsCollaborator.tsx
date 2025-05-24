"use client";

import { useState } from "react";
import { toast } from "sonner";
import CheckboxChangeState from "../checkbox/CheckboxChangeState";
import AreaSelect from "./AreaSelect";
import { Input } from "../ui/input";
import { patch } from "@/lib/services/apiService";

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
  const [salary, setSalary] = useState<number | undefined>(monthly_salary);
  const [displaySalary, setDisplaySalary] = useState<string>(
    monthly_salary ? monthly_salary.toLocaleString("es-CO") : ""
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);

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
  };

  const handleSalaryBlur = async () => {
    if (salary === monthly_salary) return;

    setIsSaving(true);
    try {
      const response = await patch(`users/${user_id}`, {
        monthly_salary: salary,
      });

      if (!response.ok) {
        throw new Error(response.error || "Error al actualizar el salario");
      }

      toast.success("Salario actualizado correctamente");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al actualizar el salario"
      );
      setSalary(monthly_salary);
      setDisplaySalary(
        monthly_salary ? monthly_salary.toLocaleString("es-CO") : ""
      );
    } finally {
      setIsSaving(false);
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
              onBlur={handleSalaryBlur}
              disabled={isSaving}
            />
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
