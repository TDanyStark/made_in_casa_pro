import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { decrypt } from "@/lib/session";
import { getProjectById, userCanAccessProject } from "@/lib/queries/projects";
import {
  addDriveFolderPermission,
  deleteDriveFolderPermission,
  listDriveFolderPermissions,
} from "@/lib/services/googleDrive";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES, PROJECT_EDIT_ROLES } from "@/lib/role-groups";

const addSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["reader", "writer"]).default("writer"),
});

const deleteSchema = z.object({
  permissionId: z.string().trim().min(1),
});

type Params = { params: Promise<{ id: string }> };

async function getAuthorizedProject(request: NextRequest, id: string, mutate: boolean) {
  const projectId = Number(id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return { response: NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 }) };
  }
  const roleValidation = await validateApiRole(
    request,
    mutate ? PROJECT_EDIT_ROLES : AUTHENTICATED_ROLES
  );
  if (!roleValidation.isAuthorized) return { response: roleValidation.response };
  const cookie = (await cookies()).get("session")?.value;
  const session = cookie ? await decrypt(cookie) : null;
  if (!session?.id) {
    return { response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  const canAccess = await userCanAccessProject(projectId, Number(session.id), roleValidation.userRole);
  if (!canAccess) {
    return { response: NextResponse.json({ error: "Acceso prohibido" }, { status: 403 }) };
  }
  const project = await getProjectById(projectId);
  if (!project) {
    return { response: NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 }) };
  }
  if (!project.drive_folder_id) {
    return { response: NextResponse.json({ error: "El proyecto no tiene una carpeta de Drive vinculada" }, { status: 409 }) };
  }
  return { project };
}

function driveError() {
  return NextResponse.json(
    { error: "No se pudo completar la operación en Google Drive" },
    { status: 502 }
  );
}

export async function GET(request: NextRequest, { params }: Params) {
  const method = validateHttpMethod(request, ["GET"]);
  if (!method.isValidMethod) return method.response;
  const { id } = await params;
  const authorized = await getAuthorizedProject(request, id, false);
  if ("response" in authorized) return authorized.response;
  try {
    return NextResponse.json(await listDriveFolderPermissions(authorized.project.drive_folder_id!));
  } catch (error) {
    console.error("Error listing project Drive permissions:", error);
    return driveError();
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const method = validateHttpMethod(request, ["POST"]);
  if (!method.isValidMethod) return method.response;
  const { id } = await params;
  const authorized = await getAuthorizedProject(request, id, true);
  if ("response" in authorized) return authorized.response;
  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.format() }, { status: 400 });
  }
  try {
    await addDriveFolderPermission(
      authorized.project.drive_folder_id!,
      parsed.data.email,
      parsed.data.role
    );
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error adding project Drive permission:", error);
    return driveError();
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const method = validateHttpMethod(request, ["DELETE"]);
  if (!method.isValidMethod) return method.response;
  const { id } = await params;
  const authorized = await getAuthorizedProject(request, id, true);
  if ("response" in authorized) return authorized.response;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.format() }, { status: 400 });
  }
  try {
    await deleteDriveFolderPermission(authorized.project.drive_folder_id!, parsed.data.permissionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project Drive permission:", error);
    return driveError();
  }
}
