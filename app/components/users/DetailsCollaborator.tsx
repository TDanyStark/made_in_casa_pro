"use client";

import { useState, KeyboardEvent } from "react";
import { toast } from "sonner";
import CheckboxChangeState from "../checkbox/CheckboxChangeState";
import AreaSelect from "./AreaSelect";
import SkillsByColaborator from "./SkillsByColaborator";
import { Input } from "../ui/input";
import { patch } from "@/lib/services/apiService";
import EnterSvg from "../icons/EnterSvg";
import { ColaboradorType } from "@/lib/definitions";

interface DetailsCollaboratorProps {
  user_id: number;
  is_internal: boolean;
  area_id: number;
  skills?: string[];
  hourly_rate?: number | null;
}

const DetailsCollaborator = ({
  user_id,
  is_internal,
  area_id,
  hourly_rate,
}: DetailsCollaboratorProps) => {
  const [isInternal, setIsInternal] = useState<boolean>(is_internal);
  // Mantener un estado para el valor actual de la hora después de actualizaciones
  const initialRate = hourly_rate ?? 0;
  const [currentRate, setCurrentRate] = useState<number>(initialRate);
  const [rate, setRate] = useState<number | undefined>(initialRate);
  const [displayRate, setDisplayRate] = useState<string>(
    initialRate ? initialRate.toLocaleString("es-CO") : ""
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

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const cleanValue = inputValue.replace(/[^0-9]/g, "");

    // Actualiza el valor numérico para guardar
    setRate(cleanValue ? Number(cleanValue) : undefined);

    // Actualiza el valor formateado para mostrar
    setDisplayRate(formatNumberWithCommas(cleanValue));

    // Indica que el usuario está editando
    setIsEditing(cleanValue ? Number(cleanValue) !== currentRate : false);
  };

  const updateRate = async () => {
    if (rate === currentRate || rate === undefined) return;

    setIsSaving(true);

    try {
      const promise = patch<ColaboradorType>(`users/${user_id}`, {
        hourly_rate: rate,
      });

      toast.promise(promise, {
        loading: "Actualizando valor de la hora...",
        success: (data) => {
          const res = data.data;
          // Actualizar el valor actual de la hora después de una actualización exitosa
          if (rate !== undefined) {
            setCurrentRate(Number(res?.hourly_rate) || 0);
          }
          setIsEditing(false);
          return "Valor de la hora actualizado correctamente";
        },
        error: (err) => {
          setRate(currentRate);
          setDisplayRate(
            currentRate ? currentRate.toLocaleString("es-CO") : ""
          );
          return err instanceof Error
            ? err.message
            : "Error al actualizar el valor de la hora";
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
      updateRate();
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
            htmlFor="hourly-rate"
            className="text-sm font-medium mb-2 block"
          >
            Valor de la hora
          </label>
          <div className="relative">
            <span className="absolute md:text-xl left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              $
            </span>
            <Input
              id="hourly-rate"
              type="text"
              inputMode="numeric"
              placeholder="Ingresa cuánto vale la hora"
              className="w-full pl-7 font-medium md:text-xl"
              value={displayRate}
              onChange={handleRateChange}
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
          <p className="mt-1 text-xs text-muted-foreground">
            Las tareas ya completadas conservan el valor de la hora con el que se cerraron.
          </p>
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
      <SkillsByColaborator user_id={user_id} className="mt-6" />
    </div>
  );
};

export default DetailsCollaborator;
