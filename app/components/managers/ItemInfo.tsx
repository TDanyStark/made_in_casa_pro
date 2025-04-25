"use client";

import { Copy, Mail, Phone, LucideIcon, Check, X, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import AutoResizeInput from "../input/AutoResizeInput";
import { patch } from "@/lib/services/apiService";

// Tipo para las claves de icono disponibles
export type IconKey = "email" | "phone";

const IconMap: Record<IconKey, LucideIcon> = {
  email: Mail,
  phone: Phone,
};

interface Props {
  label: string;
  value: string;
  key_update: IconKey;
  onUpdate?: (newValue: string) => void;
}

const ItemInfo = ({
  label,
  value: initialValue,
  key_update,
  onUpdate,
}: Props) => {
  const params = useParams();
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [inputValue, setInputValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Obtén el componente de icono adecuado
  const Icon = IconMap[key_update];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

    // Validar email básico si es campo de correo
    if (key_update === "email" && !inputValue.includes("@")) {
      toast.error("Por favor ingrese un correo electrónico válido");
      return;
    }

    setIsSubmitting(true);

    try {
      // Usar el servicio API centralizado 
      const response = await patch(`managers/${params.id}`, {
        [key_update]: inputValue,
      });

      if (!response.ok) {
        throw new Error(response.error || "Error al actualizar");
      }

      // Actualizar el estado local con el nuevo valor
      setValue(inputValue);

      // Llamar al callback onUpdate si existe
      if (onUpdate) {
        onUpdate(inputValue);
      }

      // Actualizar la UI y mostrar toast de éxito
      toast.success(`${label} actualizado correctamente`);
      setIsEditing(false);
    } catch (error: Error | unknown) {
      toast.error((error as Error).message || "Error al actualizar");
      setInputValue(value); // Revertir al valor original
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex justify-between group bg-gray-100/80 dark:bg-gray-800/50 p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors gap-2">
      <div className="flex items-start gap-3 w-full">
        <div className="bg-accent dark:bg-gray-800 p-2 rounded-full">
          <Icon className="h-6 w-6 text-market-green" strokeWidth={2.4} />
        </div>
        <div className="w-full">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <div className="font-medium ">
            {isEditing ? (
              <div className="flex gap-2">
                <AutoResizeInput
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
            ) : (
              <p className="h-[24px] border-b border-transparent text-gray-900 dark:text-white">{value}</p>
            )}
          </div>
        </div>
      </div>
      {isEditing && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={saveChanges}
            disabled={isSubmitting}
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelEditing}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      )}
      {!isEditing && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            onClick={() => copyToClipboard(value)}
          >
            {copied ? (
              <span className="text-xs text-primary">¡Copiado!</span>
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
export default ItemInfo;
