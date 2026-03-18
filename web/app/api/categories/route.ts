import { NextRequest, NextResponse } from "next/server";
import { categoryRepository } from "@/repositories/categoryRepository";

export async function GET() {
  try {
    const categories = await categoryRepository.list();
    return NextResponse.json({ categories });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const category = await categoryRepository.create(body);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 400 },
    );
  }
}
