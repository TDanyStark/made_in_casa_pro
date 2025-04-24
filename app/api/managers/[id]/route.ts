import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getManagerByEmail, getManagerById } from "@/lib/queries/managers";
import { turso } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Schema for validating manager update data
const managerUpdateSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Validate the data against our schema
    const validationResult = managerUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { email, phone } = validationResult.data;

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

    // Build update query based on provided fields
    const updates: string[] = [];
    const args: string[] = [];

    if (email !== undefined) {
      updates.push("email = ?");
      args.push(email);
    }

    if (phone !== undefined) {
      updates.push("phone = ?");
      args.push(phone);
    }

    // If no fields to update, return the existing manager
    if (updates.length === 0) {
      return NextResponse.json(existingManager);
    }

    // Add the ID as the last argument
    args.push(id);

    // Execute the update query
    await turso.execute({
      sql: `UPDATE managers SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    // Revalidate paths
    revalidatePath(`/managers/${id}`);
    if (existingManager.client_id) {
      revalidatePath(`/clients/${existingManager.client_id}`);
    }

    // Get the updated manager
    const updatedManager = await getManagerById(id);

    return NextResponse.json(updatedManager);
  } catch (error) {
    console.error("Error updating manager:", error);
    return NextResponse.json(
      { error: "Error al actualizar el gerente: " + error },
      { status: 500 }
    );
  }
}