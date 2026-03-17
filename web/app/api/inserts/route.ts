import { NextRequest, NextResponse } from "next/server";
import { insertRepository } from "@/repositories/insertRepository";

export async function GET(request: NextRequest) {
  try {
    const unplaced = request.nextUrl.searchParams.get("unplaced");
    if (unplaced === "true") {
      const inserts = await insertRepository.listUnplaced();
      return NextResponse.json({ inserts });
    }
    return NextResponse.json(
      { error: "Use ?unplaced=true to list unplaced inserts" },
      { status: 400 },
    );
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
