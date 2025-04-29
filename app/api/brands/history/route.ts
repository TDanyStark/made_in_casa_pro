import { getBrandManagerHistory } from "@/lib/queries/brands";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
) {
  try {
    // Extract brand ID from search params
    const searchParams = request.nextUrl.searchParams;
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json(
        { error: "Brand ID is required" },
        { status: 400 }
      );
    }

    const history = await getBrandManagerHistory(brandId);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching brand manager history:", error);
    return NextResponse.json(
      { error: "Failed to fetch brand history" },
      { status: 500 }
    );
  }
}