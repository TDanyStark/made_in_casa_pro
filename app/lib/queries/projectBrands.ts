import { db } from "../db";
import type { DbTransaction } from "../db/types";
import { DomainError } from "../errors";

/**
 * Marcas adicionales de un proyecto (migración 023).
 *
 * `projects.brand_id` sigue siendo la marca PRINCIPAL: define cliente, gerente,
 * carpeta de Drive y la línea "Marca" de los correos. `project_brands` solo
 * vincula marcas adicionales del MISMO cliente.
 */

/** Columna `additional_brands: {id, name}[]` para el SELECT de proyectos (alias `p`). */
export const ADDITIONAL_BRANDS_SELECT = `
  COALESCE((
    SELECT json_agg(json_build_object('id', ab.id, 'name', ab.name) ORDER BY ab.name)
      FROM project_brands pb
      JOIN brands ab ON ab.id = pb.brand_id
     WHERE pb.project_id = p.id
  ), '[]'::json) AS additional_brands`;

/**
 * Filtro "el proyecto pertenece a la marca $": principal o adicional.
 * Un solo placeholder y sin " AND " para servir a `buildWhereClause` y al
 * armado manual de my-tasks.
 */
export const PROJECT_BRAND_FILTER_SQL =
  "$ = ANY(ARRAY[p.brand_id] || ARRAY(SELECT pb.brand_id FROM project_brands pb WHERE pb.project_id = p.id))";

/**
 * Normaliza y valida las marcas adicionales: sin duplicados, distintas de la
 * principal, existentes y del mismo cliente. Lanza `DomainError` sin escribir.
 */
export async function validateAdditionalBrands(
  ids: number[],
  principalBrandId: number,
  clientId: number
): Promise<number[]> {
  const unique = Array.from(new Set(ids.map(Number)));
  if (unique.length === 0) return [];

  if (unique.includes(Number(principalBrandId))) {
    throw new DomainError(
      "ADDITIONAL_BRAND_IS_PRINCIPAL",
      "La marca principal no puede agregarse también como marca adicional"
    );
  }

  const result = await db.execute({
    sql: `SELECT id, client_id FROM brands WHERE id = ANY($1::int[])`,
    args: [unique],
  });
  const found = result.rows as unknown as { id: number; client_id: number }[];

  if (found.length !== unique.length) {
    throw new DomainError("BRAND_NOT_FOUND", "Una de las marcas adicionales no existe");
  }
  if (found.some((b) => Number(b.client_id) !== Number(clientId))) {
    throw new DomainError(
      "BRAND_CLIENT_MISMATCH",
      "Todas las marcas del proyecto deben pertenecer al mismo cliente"
    );
  }
  return unique;
}

/** Inserta vínculos ya validados. No hace nada con una lista vacía. */
export async function insertProjectBrands(
  tx: DbTransaction,
  projectId: number,
  brandIds: number[]
): Promise<void> {
  if (brandIds.length === 0) return;
  await tx.execute({
    sql: `INSERT INTO project_brands (project_id, brand_id)
          SELECT $1, unnest($2::int[])`,
    args: [projectId, brandIds],
  });
}

/** Reemplaza el conjunto completo de marcas adicionales (ya validadas). */
export async function replaceProjectBrands(
  tx: DbTransaction,
  projectId: number,
  brandIds: number[]
): Promise<void> {
  await tx.execute({
    sql: `DELETE FROM project_brands WHERE project_id = $1`,
    args: [projectId],
  });
  await insertProjectBrands(tx, projectId, brandIds);
}
