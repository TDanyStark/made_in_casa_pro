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

const DetailsCollaborator = ({  user_id,
  is_internal,
  area_id,
  monthly_salary = 0,
}: DetailsCollaboratorProps) => {
  const [isInternal, setIsInternal] = useState<boolean>(is_internal);
  const [salary, setSalary] = useState<number | undefined>(monthly_salary);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  console.log({
    salary,
    monthly_salary,
  });


  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSalary(e.target.value ? Number(e.target.value) : undefined);
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
        error instanceof Error ? error.message : "Error al actualizar el salario"
      );
      setSalary(monthly_salary);
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
      />

      {isInternal && (
        <div className="mt-4">
          <label
            htmlFor="monthly-salary"
            className="text-sm font-medium mb-2 block text-muted-foreground"
          >
            Sueldo Mensual
          </label>
          <Input
            id="monthly-salary"
            type="number"
            placeholder="Ingresa el sueldo mensual"
            className="w-full"
            value={salary || ""}
            onChange={handleSalaryChange}
            onBlur={handleSalaryBlur}
            disabled={isSaving}
          />
        </div>
      )}

      <AreaSelect
        initial_value={area_id}
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
