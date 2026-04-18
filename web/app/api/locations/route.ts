import { NextRequest, NextResponse } from "next/server";
import { locationRepository } from "@/repositories/locationRepository";

export async function GET(request: NextRequest) {
  try {
    const moduleId = request.nextUrl.searchParams.get("moduleId");
    const insertId = request.nextUrl.searchParams.get("insertId");
    let locations;
    if (insertId) {
      locations = await locationRepository.findByInsertId({ insertId });
    } else if (moduleId) {
      locations = await locationRepository.findByModuleId({ moduleId });
    } else {
      return NextResponse.json(
        { error: "moduleId or insertId query parameter is required" },
        { status: 400 },
      );
    }
    // Attach accepted interfaces per location (batched).
    const ids = locations.map((l) => l.id);
    const ifaceMap = await locationRepository.getAcceptedInterfacesByLocationIds(
      { locationIds: ids },
    );
    return NextResponse.json({
      locations: locations.map((l) => ({
        ...l,
        interfacesAccepted: ifaceMap.get(l.id) ?? [],
      })),
    });
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
    const location = await locationRepository.create(body);
    return NextResponse.json({ location }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 400 },
    );
  }
}
