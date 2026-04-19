import { NextRequest, NextResponse } from "next/server";
import { locationRepository } from "@/repositories/locationRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const moduleId = request.nextUrl.searchParams.get("moduleId");
    const insertId = request.nextUrl.searchParams.get("insertId");
    let locations;
    if (insertId) {
      locations = await locationRepository.findByInsertId({
        orgId: ctx.activeOrgId,
        insertId,
      });
    } else if (moduleId) {
      locations = await locationRepository.findByModuleId({
        orgId: ctx.activeOrgId,
        moduleId,
      });
    } else {
      return NextResponse.json(
        { error: "moduleId or insertId query parameter is required" },
        { status: 400 },
      );
    }
    // Attach accepted interfaces per location (batched).
    const ids = locations.map((l) => l.id);
    const ifaceMap = await locationRepository.getAcceptedInterfacesByLocationIds(
      { orgId: ctx.activeOrgId, locationIds: ids },
    );
    return NextResponse.json({
      locations: locations.map((l) => ({
        ...l,
        interfacesAccepted: ifaceMap.get(l.id) ?? [],
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const location = await locationRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      ...body,
    });
    return NextResponse.json({ location }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
