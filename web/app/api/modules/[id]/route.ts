import { NextRequest, NextResponse } from "next/server";
import { moduleRepository } from "@/repositories/moduleRepository";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const mod = await moduleRepository.findById({ id });
    if (!mod) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    return NextResponse.json({ module: mod });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, primaryDimensionLabel, primaryDimensionCount, metadata } = body;

    const mod = await moduleRepository.update({
      id,
      name,
      description,
      primaryDimensionLabel,
      primaryDimensionCount,
      metadata,
    });

    return NextResponse.json({ module: mod });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cascade = request.nextUrl.searchParams.get("cascade") === "true";
    if (cascade) {
      const stats = await moduleRepository.removeWithCascade({ id });
      return NextResponse.json({ success: true, stats });
    }
    await moduleRepository.remove({ id });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
