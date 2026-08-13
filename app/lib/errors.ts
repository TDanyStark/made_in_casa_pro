/**
 * Errores de dominio identificables por código.
 *
 * La capa de queries no conoce HTTP. Lanza `DomainError` con un código y el
 * handler de la ruta lo traduce al status correcto (400 / 404 / 409) en vez de
 * caer en el `catch` genérico que devuelve 500.
 */

export type DomainErrorCode =
  /** El gerente indicado no existe */
  | "MANAGER_NOT_FOUND"
  /** El gerente no pertenece al cliente de la marca / proyecto */
  | "MANAGER_CLIENT_MISMATCH"
  /** El email ya lo usa otro gerente (managers.email es UNIQUE global) */
  | "EMAIL_IN_USE"
  /** El cliente destino del traslado es el mismo que el actual */
  | "SAME_CLIENT"
  | "CLIENT_NOT_FOUND"
  | "BRAND_NOT_FOUND"
  | "PROJECT_NOT_FOUND";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    // Necesario para que `instanceof` funcione al compilar a ES5/CommonJS.
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** Status HTTP por defecto para cada código de dominio. */
export const DOMAIN_ERROR_STATUS: Record<DomainErrorCode, number> = {
  MANAGER_NOT_FOUND: 404,
  MANAGER_CLIENT_MISMATCH: 400,
  EMAIL_IN_USE: 409,
  SAME_CLIENT: 400,
  CLIENT_NOT_FOUND: 404,
  BRAND_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
};
