import { NextRequest, NextResponse } from "next/server";
import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const validStatuses = new Set(["active", "archived", "all"]);
    const filterStatus = validStatuses.has(status ?? "")
      ? (status as "active" | "archived" | "all")
      : "all";
    const interfaceTypes = await interfaceTypeRepository.list({
      status: filterStatus,
    });
    return NextResponse.json({ interfaceTypes });
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
    const interfaceType = await interfaceTypeRepository.create(body);
    return NextResponse.json({ interfaceType }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 400 },
    );
  }
}
