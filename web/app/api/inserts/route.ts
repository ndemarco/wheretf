import { NextRequest, NextResponse } from "next/server";
import { insertRepository } from "@/repositories/insertRepository";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    // Legacy: ?unplaced=true returns raw list without joins.
    if (params.get("unplaced") === "true") {
      const inserts = await insertRepository.listUnplaced();
      return NextResponse.json({ inserts });
    }

    const placementParam = params.get("placement");
    const placement: "placed" | "unplaced" | "all" =
      placementParam === "placed" || placementParam === "unplaced"
        ? placementParam
        : "all";

    const inserts = await insertRepository.listWithDetails({
      templateId: params.get("templateId") ?? undefined,
      interfaceType: params.get("interfaceType") ?? undefined,
      moduleId: params.get("moduleId") ?? undefined,
      placement,
    });
    return NextResponse.json({ inserts });
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
    const insert = await insertRepository.create(body);
    return NextResponse.json({ insert }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 400 },
    );
  }
}
