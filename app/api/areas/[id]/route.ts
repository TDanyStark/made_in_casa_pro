import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const result = await db.execute({
      sql: `SELECT id, name FROM areas WHERE id = $1`,
      args: [parseInt(id)],
    });
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Área no encontrada" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching area:", error);
    return NextResponse.json({ error: "Error al obtener área" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }
    await db.execute({
      sql: `UPDATE areas SET name = $1 WHERE id = $2`,
      args: [name, parseInt(id)],
    });
    const result = await db.execute({
      sql: `SELECT id, name FROM areas WHERE id = $1`,
      args: [parseInt(id)],
    });
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating area:", error);
    return NextResponse.json({ error: "Error al actualizar área" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    await db.execute({
      sql: `DELETE FROM areas WHERE id = $1`,
      args: [parseInt(id)],
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting area:", error);
    return NextResponse.json({ error: "Error al eliminar área" }, { status: 500 });
  }
}
