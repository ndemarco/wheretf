import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: standardId } = await params;
    const body = await request.json();
    const { aspectId } = body;

    if (!aspectId) {
      return NextResponse.json(
        { error: "aspectId is required" },
        { status: 400 }
      );
    }

    const link = await standardRepository.addAspect({ standardId, aspectId });
    return NextResponse.json({ link }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: standardId } = await params;
    const { searchParams } = new URL(request.url);
    const aspectId = searchParams.get("aspectId");

    if (!aspectId) {
      return NextResponse.json(
        { error: "aspectId query parameter is required" },
        { status: 400 }
      );
    }

    await standardRepository.removeAspect({ standardId, aspectId });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
