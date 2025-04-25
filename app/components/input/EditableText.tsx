"use client";

import React, { useState, ReactNode, useEffect } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AutoResizeInput from "./AutoResizeInput";

interface EditableTextProps {
  value: string;
  height: number;
  endpoint: string;
  fieldName: string;
  className?: string;
  children?: ReactNode;
  onUpdate?: (newValue: string) => void;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";
  endpointIdParam?: string;
}

const EditableText = ({
  value: initialValue,
  height,
  endpoint,
  fieldName,
  className = "",
  children,
  onUpdate,
  as: Component = "span",
}: EditableTextProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [inputValue, setInputValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Actualizar el valor local si cambia el valor inicial (desde props)
  useEffect(() => {
    setValue(initialValue);
    setInputValue(initialValue);
  }, [initialValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveChanges();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const cancelEditing = () => {
    setInputValue(value);
    setIsEditing(false);
  };

  const saveChanges = async () => {
    if (inputValue === value) {
      setIsEditing(false);
      return;
    }

    if (!inputValue.trim()) {
      toast.error("El campo no puede estar vacío");
      return;
    }

    setIsSubmitting(true);

    try {
      // Hacer la petición a la API
      const response = await fetch(`/api/${endpoint}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [fieldName]: inputValue,
        }),
      });

      const data = await response.json();
      console.log("Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar");
      }

      // Actualizar el estado local con el nuevo valor
      setValue(inputValue);

      // Llamar al callback onUpdate si existe
      if (onUpdate) {
        onUpdate(inputValue);
      }

      // Actualizar la UI y mostrar toast de éxito
      toast.success(`Actualizado correctamente`);
      setIsEditing(false);
    } catch (error: Error | unknown) {
      toast.error((error as Error).message || "Error al actualizar");
      setInputValue(value); // Revertir al valor original
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className={`group relative inline-block ${className}`}
    >
      {isEditing ? (
        <div className="flex items-center gap-1">
          <AutoResizeInput
            value={inputValue}
            height={height}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            disabled={isSubmitting}
            className="text-inherit font-inherit"
          />
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={saveChanges}
              disabled={isSubmitting}
              className="h-6 w-6"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={cancelEditing}
              disabled={isSubmitting}
              className="h-6 w-6"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="inline-flex items-center">
          <Component className="inline-block">{children || value}</Component>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default EditableText;