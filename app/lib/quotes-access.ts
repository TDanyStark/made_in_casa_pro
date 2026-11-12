import { UserRole } from "./definitions";

export const INTERNAL_QUOTES_FORBIDDEN_MESSAGE = "Los colaboradores internos no tienen cotizaciones";

/** Only external collaborators quote tasks, so only they get "Mis Cotizaciones". */
export function canAccessMyQuotes(role: UserRole | number, isInternal: boolean): boolean {
  return role === UserRole.COLABORADOR && !isInternal;
}
