import { NextRequest, NextResponse } from "next/server";
import { locationRepository } from "@/repositories/locationRepository";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const result = await locationRepository.unmerge({ originId: id });
    return NextResponse.json({ unmerge: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("No merged")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
