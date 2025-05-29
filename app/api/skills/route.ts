import { NextRequest, NextResponse } from 'next/server';
import { z } from "zod";
import { 
  getSkills, 
  createSkill,
  getSkillById,
  getSkillsWithPagination
} from '@/lib/queries/skills';
import { SkillType, UserRole } from '@/lib/definitions';
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { ITEMS_PER_PAGE } from "@/config/constants";

// Schema for validating skill data
const skillSchema = z.object({
  name: z.string().min(1)
});

export async function GET(request: NextRequest) {
  // Validate HTTP method
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validate user role (allow all authenticated users to view skills)
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
    const id = url.searchParams.get("id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || ITEMS_PER_PAGE.toString());
    const search = url.searchParams.get("search");
    
    // If requesting a specific skill by ID
    if (id) {
      const skill = await getSkillById(id);
      if (!skill) {
        return NextResponse.json(
          { error: "Skill not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(skill);
    } 
    else if (search || page > 1) {
      // If search or pagination is needed
      const { skills, total } = await getSkillsWithPagination({
        page,
        limit,
        search: search || undefined
      });
      
      // Calculate total pages
      const pageCount = Math.ceil(total / limit);
      
      return NextResponse.json({
        data: skills,
        pageCount,
        currentPage: page,
        total
      });
    }
    else {
      // Get all skills
      const skills = await getSkills();
      
      return NextResponse.json(
        { data: skills },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error fetching skills:', error);
    return NextResponse.json(
      { error: 'Error fetching skills' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Validate HTTP method
  const methodValidation = validateHttpMethod(request, ['POST']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validate user role (only admins and directors can create skills)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.DIRECTIVO
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    // Parse request body
    const body = await request.json();
    
    // Validate data
    const validationResult = skillSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid skill data", details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    // Create skill data object
    const skillData: Omit<SkillType, "id"> = {
      name: validationResult.data.name.trim()
    };
    
    // Create new skill
    const newSkill = await createSkill(skillData);

    return NextResponse.json(newSkill, { status: 201 });
  } catch (error) {
    console.error('Error creating skill:', error);
    return NextResponse.json(
      { error: 'Error creating skill' },
      { status: 500 }
    );
  }
}
