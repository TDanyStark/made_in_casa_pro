import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getCampaignsWithPagination, createCampaign } from "@/lib/queries/campaigns";
import { ITEMS_PER_PAGE } from "@/config/constants";

const campaignSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  client_id: z.coerce.number().int().positive("El cliente es requerido"),
});

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || ITEMS_PER_PAGE.toString());
  const search = url.searchParams.get("search") || undefined;
  const clientIdParam = url.searchParams.get("client_id");
  const clientId = clientIdParam ? parseInt(clientIdParam) : undefined;

  const { campaigns, total } = await getCampaignsWithPagination({
    page, limit, search, clientId,
  });
  const pageCount = Math.ceil(total / limit);
  return NextResponse.json({ data: campaigns, pageCount, currentPage: page, total });
}

export async function POST(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const body = await request.json();
    const validation = campaignSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }
    const campaign = await createCampaign(validation.data.name, validation.data.client_id);
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json({ error: "Error al crear la campaña" }, { status: 500 });
  }
}
