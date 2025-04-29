import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBrandById, updateBrand } from "@/lib/queries/brands";
import { revalidatePath } from "next/cache";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

// Schema for validating brand update data
const brandUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  manager_id: z.coerce.number().int().positive().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validar método HTTP
      const methodValidation = validateHttpMethod(request, ['PATCH']);
      if (!methodValidation.isValidMethod) {
        return methodValidation.response;
      }
    
      const roleValidation = validateApiRole(request, [
        UserRole.ADMIN, 
        UserRole.COMERCIAL, 
        UserRole.DIRECTIVO
      ]);
      if (!roleValidation.isAuthorized) {
        return roleValidation.response;
      }
  try {
    // Await the params object before accessing its properties
    const { id } = await params;
    const body = await request.json();

    // Validate the data against our schema
    const validationResult = brandUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { name, manager_id } = validationResult.data;

    // Check if the brand exists
    const existingBrand = await getBrandById(id);
    if (!existingBrand) {
      return NextResponse.json(
        { error: "La marca no existe" },
        { status: 404 }
      );
    }

    // If no fields to update, return the existing brand
    if (!name && !manager_id) {
      return NextResponse.json(existingBrand);
    }

    // Update brand using the model function
    const updatedBrand = await updateBrand(id, { name, manager_id });

    // Revalidate paths
    revalidatePath(`/brands/${id}`);
    // If the brand has a manager with a client, revalidate that client's path too
    if (existingBrand.manager && existingBrand.manager.client_info) {
      revalidatePath(`/clients/${existingBrand.manager.client_info.id}`);
    }

    return NextResponse.json(updatedBrand);
  } catch (error) {
    console.error("Error updating brand:", error);
    return NextResponse.json(
      { error: "Error al actualizar la marca: " + error },
      { status: 500 }
    );
  }
}