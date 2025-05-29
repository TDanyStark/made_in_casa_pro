import { NextRequest, NextResponse } from 'next/server';
import { z } from "zod";
import { getUserSkills, addUserSkill, removeUserSkill } from '@/lib/queries/userSkills';
import { UserRole } from '@/lib/definitions';
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";

// Schema for validating user skill data
const userSkillSchema = z.object({
  user_id: z.number(),
  skill_id: z.number()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }>  }
) {
  // Validate HTTP method
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validate user role (allow all authenticated users to view user skills)
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
    const { id } = await params;
    const userId = Number(id);
    console.log(`Fetching skills for user ID: ${userId}`);
    const userSkills = await getUserSkills(userId);
    
    return NextResponse.json({ data: userSkills }, { status: 200 });
  } catch (error) {
    console.error('Error fetching user skills:', error);
    return NextResponse.json(
      { error: 'Error fetching user skills' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate HTTP method
  const methodValidation = validateHttpMethod(request, ['POST']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validate user role (only admins and directors can add user skills)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.DIRECTIVO,
    UserRole.COLABORADOR // Allow colaboradores to update their own skills
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    // Parse request body
    const body = await request.json();
    const { id } = await params;
    const userId = Number(id);

    // Add skill_id to the body for validation
    body.user_id = userId;
    
    // Validate data
    const validationResult = userSkillSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid user skill data", details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    // Add user skill
    const userSkill = await addUserSkill(userId, validationResult.data.skill_id);

    return NextResponse.json(userSkill, { status: 201 });
  } catch (error) {
    console.error('Error adding user skill:', error);
    return NextResponse.json(
      { error: 'Error adding user skill' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Validate HTTP method
  const methodValidation = validateHttpMethod(request, ['DELETE']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validate user role (only admins, directors, and the user themselves can remove skills)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.DIRECTIVO,
    UserRole.COLABORADOR
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    // Parse request - expecting {skill_id: number} in the URL search params
    const url = new URL(request.url);
    const skillIdParam = url.searchParams.get("skill_id");
    
    if (!skillIdParam) {
      return NextResponse.json(
        { error: "skill_id parameter is required" },
        { status: 400 }
      );
    }
    const { id } = await params;
    const userId = Number(id);
    const skillId = Number(skillIdParam);

    // Remove user skill
    await removeUserSkill(userId, skillId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error removing user skill:', error);
    return NextResponse.json(
      { error: 'Error removing user skill' },
      { status: 500 }
    );
  }
}
