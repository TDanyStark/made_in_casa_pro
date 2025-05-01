import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBusinessUnit, getBusinessUnitsWithPagination } from "@/lib/queries/businessUnits";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

// Schema to validate business unit data
const businessUnitSchema = z.object({
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  // Validate HTTP method
  const methodValidation = validateHttpMethod(request, ['POST']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validate user role (only admins and managers can create business units)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.DIRECTIVO,
    UserRole.COMERCIAL
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    const body = await request.json();
    
    // Validate input data
    const validationResult = businessUnitSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid business unit data", details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const businessUnitData = validationResult.data;
    
    // Create the business unit
    const newBusinessUnit = await createBusinessUnit(businessUnitData);
    
    return NextResponse.json(newBusinessUnit, { status: 201 });
  } catch (error) {
    console.error("Error creating business unit:", error);
    return NextResponse.json(
      { error: "Error creating business unit" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Validate HTTP method
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validate user role (allow all authenticated users to view business units)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.COMERCIAL, 
    UserRole.DIRECTIVO,
    UserRole.COLABORADOR
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || ITEMS_PER_PAGE.toString());
    const search = url.searchParams.get("search");
    
    // Get paginated results
    const { businessUnits, total } = await getBusinessUnitsWithPagination({
      page,
      limit,
      search: search || undefined
    });
    
    // Calculate total pages
    const pageCount = Math.ceil(total / limit);
    
    return NextResponse.json({
      data: businessUnits,
      pageCount,
      currentPage: page,
      total
    });
  } catch (error) {
    console.error("Error fetching business units:", error);
    return NextResponse.json(
      { error: "Error fetching business units" },
      { status: 500 }
    );
  }
}