import { NextResponse } from "next/server";
import { DOMAIN_ERROR_STATUS, isDomainError } from "@/lib/errors";

/**
 * Traduce un `DomainError` lanzado por la capa de queries a su respuesta HTTP.
 * Devuelve `null` si el error no es de dominio, para que el handler siga con su
 * `catch` genérico de 500.
 *
 *   catch (error) {
 *     const domain = domainErrorResponse(error);
 *     if (domain) return domain;
 *     return NextResponse.json({ error: "..." }, { status: 500 });
 *   }
 */
export function domainErrorResponse(error: unknown): NextResponse | null {
  if (!isDomainError(error)) return null;
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: DOMAIN_ERROR_STATUS[error.code] }
  );
}
