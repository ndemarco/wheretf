import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = params.get("q") || undefined;
    const categoryId = params.get("category") || undefined;
    const sortBy = params.get("sort") || undefined;
    const sortDirection = (params.get("dir") || "asc") as "asc" | "desc";

    // Parse filter params: filter=paramDefId:value,paramDefId:value
    const filterParam = params.get("filter");
    let filters: { parameterDefinitionId: string; value: unknown }[] | undefined;
    if (filterParam) {
      filters = filterParam.split(",").map((f) => {
        const colonIdx = f.indexOf(":");
        const parameterDefinitionId = f.slice(0, colonIdx);
        const rawValue = f.slice(colonIdx + 1);
        // Try parsing as JSON for numbers/booleans, fall back to string
        let value: unknown;
        try {
          value = JSON.parse(rawValue);
        } catch {
          value = rawValue;
        }
        return { parameterDefinitionId, value };
      });
    }

    const result = await itemRepository.listRich({
      query: q,
      filters,
      categoryId,
      sortBy,
      sortDirection,
    });

    return NextResponse.json(result);
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
    const item = await itemRepository.create(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 400 },
    );
  }
}
