import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const standards = await standardRepository.getItemStandards({ itemId: id });
    return NextResponse.json({ standards });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { standardId, designationId } = body;

    if (!standardId) {
      return NextResponse.json(
        { error: "standardId is required" },
        { status: 400 }
      );
    }

    const itemStandard = await standardRepository.applyToItem({
      itemId: id,
      standardId,
      designationId,
    });

    return NextResponse.json({ itemStandard }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { standardId, designationId } = body;

    if (!standardId) {
      return NextResponse.json(
        { error: "standardId is required" },
        { status: 400 }
      );
    }

    const updated = await standardRepository.setDesignation({
      itemId: id,
      standardId,
      designationId,
    });

    return NextResponse.json({ itemStandard: updated });
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
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const standardId = searchParams.get("standardId");

    if (!standardId) {
      return NextResponse.json(
        { error: "standardId query param is required" },
        { status: 400 }
      );
    }

    await standardRepository.removeFromItem({ itemId: id, standardId });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
