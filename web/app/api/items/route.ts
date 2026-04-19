import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
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
      orgId: ctx.activeOrgId,
      query: q,
      filters,
      categoryId,
      sortBy,
      sortDirection,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { name, description, metadata, asGlobal } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const item = await itemRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      asGlobal: Boolean(asGlobal),
      name,
      description,
      metadata,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
