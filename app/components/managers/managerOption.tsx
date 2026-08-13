"use client";

import { ManagerType } from "@/lib/definitions";

/**
 * Opción de gerente compartida por los selects.
 *
 * Todos los selects mostraban únicamente `manager.name`, así que dos gerentes
 * homónimos eran indistinguibles. La opción lleva ahora el correo (siempre) y el
 * cliente (solo cuando el select NO está filtrado por cliente y por tanto puede
 * mezclar laboratorios).
 */
export interface ManagerOption {
  value: number;
  label: string;
  email?: string;
  clientId?: number;
}

export function toManagerOption(manager: ManagerType): ManagerOption {
  return {
    value: manager.id as number,
    label: manager.name,
    email: manager.email,
    clientId: manager.client_id,
  };
}

interface FormatterConfig {
  /** Nombres de cliente por id; vacío si no se necesita mostrar el cliente. */
  clientNames?: Record<number, string>;
  /** `true` cuando el select mezcla clientes y hay que desambiguar. */
  showClient?: boolean;
}

export function createManagerOptionFormatter({
  clientNames = {},
  showClient = false,
}: FormatterConfig = {}) {
  const ManagerOptionLabel = (option: ManagerOption) => {
    const clientName = showClient && option.clientId
      ? clientNames[option.clientId]
      : undefined;

    // Las opciones "Crear gerente ..." de CreatableSelect no traen metadatos.
    if (!option.email && !clientName) {
      return <span>{option.label}</span>;
    }

    return (
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium">{option.label}</span>
        <span className="text-xs text-muted-foreground">
          {option.email}
          {option.email && clientName ? " · " : ""}
          {clientName}
        </span>
      </div>
    );
  };

  ManagerOptionLabel.displayName = "ManagerOptionLabel";

  return ManagerOptionLabel;
}
