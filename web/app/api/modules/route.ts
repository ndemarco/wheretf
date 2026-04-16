import { NextRequest, NextResponse } from "next/server";
import { moduleRepository } from "@/repositories/moduleRepository";

export async function GET() {
  try {
    const modules = await moduleRepository.list();
    return NextResponse.json({ modules });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, primaryDimensionLabel, primaryDimensionCount, metadata } = body;

    if (!name || !primaryDimensionLabel || primaryDimensionCount == null) {
      return NextResponse.json(
        { error: "name, primaryDimensionLabel, and primaryDimensionCount are required" },
        { status: 400 }
      );
    }

    const mod = await moduleRepository.create({
      name,
      description,
      primaryDimensionLabel,
      primaryDimensionCount,
      metadata,
    });

    return NextResponse.json({ module: mod }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
