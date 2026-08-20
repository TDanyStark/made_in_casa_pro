import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { decrypt } from "@/lib/session";
import {
  clearProjectDriveAccessFailure,
  getProjectById,
  getProjectDriveAccessFailures,
  getProjectExpectedDriveRecipients,
  upsertProjectDriveAccessFailure,
  userCanAccessProject,
} from "@/lib/queries/projects";
import {
  addDriveFolderPermission,
  classifyDrivePermissionFailure,
  deleteDriveFolderPermission,
  listDriveFolderPermissions,
} from "@/lib/services/googleDrive";
import { buildExpectedDriveRecipientStatuses } from "@/lib/services/projectDriveAccess";
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
  return {
    project,
    canViewExpectedRecipients: PROJECT_EDIT_ROLES.some(
      (role) => role === roleValidation.userRole
    ),
  };
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
    const drivePermissions = await listDriveFolderPermissions(authorized.project.drive_folder_id!);
    if (!authorized.canViewExpectedRecipients) {
      return NextResponse.json(drivePermissions);
    }
    const [recipients, failures] = await Promise.all([
      getProjectExpectedDriveRecipients(Number(authorized.project.id)),
      getProjectDriveAccessFailures(Number(authorized.project.id)),
    ]);
    return NextResponse.json({
      ...drivePermissions,
      expectedRecipients: buildExpectedDriveRecipientStatuses(
        recipients,
        drivePermissions.permissions,
        failures
      ),
    });
  } catch {
    console.error("PROJECT_DRIVE_PERMISSIONS_LIST_FAILED", { projectId: id });
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
    try {
      await clearProjectDriveAccessFailure(Number(authorized.project.id), parsed.data.email);
    } catch {
      console.error("PROJECT_DRIVE_FAILURE_CLEAR_FAILED", {
        projectId: authorized.project.id,
      });
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    try {
      await upsertProjectDriveAccessFailure(
        Number(authorized.project.id),
        parsed.data.email,
        classifyDrivePermissionFailure(error)
      );
    } catch {
      console.error("PROJECT_DRIVE_FAILURE_PERSIST_FAILED", {
        projectId: authorized.project.id,
      });
    }
    console.error("PROJECT_DRIVE_PERMISSION_ADD_FAILED", {
      projectId: authorized.project.id,
      failureCode: classifyDrivePermissionFailure(error),
    });
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
  } catch {
    console.error("PROJECT_DRIVE_PERMISSION_DELETE_FAILED", {
      projectId: authorized.project.id,
    });
    return driveError();
  }
}
