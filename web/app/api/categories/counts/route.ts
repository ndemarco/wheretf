import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const params = request.nextUrl.searchParams;
    const q = params.get("q") || undefined;

    // Parse filter params same as items route
    const filterParam = params.get("filter");
    let filters:
      | { parameterDefinitionId: string; value: unknown }[]
      | undefined;
    if (filterParam) {
      filters = filterParam.split(",").map((f) => {
        const colonIdx = f.indexOf(":");
        const parameterDefinitionId = f.slice(0, colonIdx);
        const rawValue = f.slice(colonIdx + 1);
        let value: unknown;
        try {
          value = JSON.parse(rawValue);
        } catch {
          value = rawValue;
        }
        return { parameterDefinitionId, value };
      });
    }

    const categories = await itemRepository.getCategoryCounts({
      orgId: ctx.activeOrgId,
      query: q,
      filters,
    });

    return NextResponse.json({ categories });
  } catch (err) {
    return errorResponse(err);
  }
}
