import { NextRequest, NextResponse } from "next/server";
import { aspectRepository } from "@/repositories/aspectRepository";

export async function GET() {
  try {
    const aspects = await aspectRepository.list();
    return NextResponse.json({ aspects });
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
    const aspect = await aspectRepository.create(body);
    return NextResponse.json({ aspect }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 400 },
    );
  }
}
