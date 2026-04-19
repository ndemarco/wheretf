import { NextRequest, NextResponse } from "next/server";
import { locationRepository } from "@/repositories/locationRepository";
import { requireContext } from "@/lib/auth/route";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const { labels, source } = body ?? {};
    if (!Array.isArray(labels)) {
      return NextResponse.json(
        { error: "labels[] required" },
        { status: 400 }
      );
    }
    const children = await locationRepository.divide({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      parentId: id,
      labels,
      source,
    });
    return NextResponse.json({ children });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (
      message.includes("active assignments") ||
      message.includes("already divided") ||
      message.includes("unique") ||
      message.includes("non-empty") ||
      message.includes("at least two")
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const result = await locationRepository.undivide({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      parentId: id,
    });
    return NextResponse.json({ undivide: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found") || message.includes("not divided")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (
      message.includes("assignments") ||
      message.includes("subdivided")
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
