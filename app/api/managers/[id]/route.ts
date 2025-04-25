import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getManagerByEmail, getManagerById, updateManager } from "@/lib/queries/managers";
import { revalidatePath } from "next/cache";

// Schema for validating manager update data
const managerUpdateSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  biography: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params object before accessing its properties
    const { id } = await params;
    const body = await request.json();

    // Validate the data against our schema
    const validationResult = managerUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { email, phone, name, biography } = validationResult.data;

    // Check if the manager exists
    const existingManager = await getManagerById(id);
    if (!existingManager) {
      return NextResponse.json(
        { error: "El gerente no existe" },
        { status: 404 }
      );
    }

    // If email is being updated, check if it's already in use by a different manager
    if (email && email !== existingManager.email) {
      const existingManagerWithEmail = await getManagerByEmail(email);
      if (
        existingManagerWithEmail &&
        existingManagerWithEmail.id !== Number(id)
      ) {
        return NextResponse.json(
          { error: "El correo electrónico ya está en uso" },
          { status: 409 }
        );
      }
    }

    // If no fields to update, return the existing manager
    if (!email && !phone && !name && !biography) {
      return NextResponse.json(existingManager);
    }

    // Update manager using the model function
    const updatedManager = await updateManager(id, { email, phone, name, biography });

    // Revalidate paths
    revalidatePath(`/managers/${id}`);
    if (existingManager.client_id) {
      revalidatePath(`/clients/${existingManager.client_id}`);
    }

    return NextResponse.json(updatedManager);
  } catch (error) {
    console.error("Error updating manager:", error);
    return NextResponse.json(
      { error: "Error al actualizar el gerente: " + error },
      { status: 500 }
    );
  }
}