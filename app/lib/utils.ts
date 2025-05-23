import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha a la zona horaria de America/Bogota
 * @param dateString - Fecha en formato string o Date
 * @param format - Objeto de configuración para el formato (opcional)
 * @returns Fecha formateada como string o 'No disponible' si no hay fecha
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  format?: Intl.DateTimeFormatOptions
): string {
  if (!dateString) return "No disponible";

  // Si no se proporciona un formato personalizado, usar el formato "día de mes de año"
  const defaultFormat: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };

  // Usar el formato proporcionado o el formato por defecto
  const finalFormat = format || defaultFormat;

  // Convertir a objeto Date si es un string
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;

  // Restar 5 horas para compensar la diferencia horaria guardada en la BD
  const adjustedDate = new Date(date.getTime() - 5 * 60 * 60 * 1000);

  // Formatear a la zona horaria de Colombia
  return adjustedDate.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    ...finalFormat,
  });
}
