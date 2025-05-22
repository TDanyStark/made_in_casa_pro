"use client";

import { useState } from "react";
import { patch } from "@/lib/services/apiService";
import { toast } from "sonner";
import { Switch } from "../ui/switch";

interface CheckboxChangeStateProps {
  label: string;
  id?: string;
  initialChecked: boolean;
  endpoint: string;
  fieldName: string;
  className?: string;
  onUpdate?: (newValue: boolean) => void;
  disabled?: boolean;
}

const CheckboxChangeState = ({
  label = "Aceptar unidades de negocio",
  id = "checkbox-state",
  initialChecked,
  endpoint,
  fieldName,
  className = "",
  onUpdate,
  disabled = false,
}: CheckboxChangeStateProps) => {
  const [isChecked, setIsChecked] = useState(initialChecked);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckedChange = async (checked: boolean) => {
    if (disabled || isSubmitting) return;
    
    // Actualización optimista
    setIsChecked(checked);
    setIsSubmitting(true);
    
    try {
      // Usar el servicio de API centralizado
      const response = await patch(endpoint, {
        [fieldName]: checked
      });

      if (!response.ok) {
        // Si hay error, revertimos el cambio
        setIsChecked(!checked);
        throw new Error(response.error || "Error al actualizar");
      }
      
      // Llamar al callback onUpdate si existe
      if (onUpdate) {
        onUpdate(checked);
      }

      toast.success("Actualizado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar");
      // Ya no necesitamos revertir aquí, ya lo hicimos arriba en caso de error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex items-center space-x-2 mt-4 ${className}`}>
      <Switch 
        id={id} 
        checked={isChecked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled || isSubmitting}
      />
      <label
        htmlFor={id}
        className={`leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none ${disabled || isSubmitting ? 'text-muted-foreground opacity-50' : 'text-muted-foreground'}`}
      >
        {label}
      </label>
    </div>
  );
};

export default CheckboxChangeState;