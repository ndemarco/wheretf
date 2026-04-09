import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parameters = await standardRepository.getParameters({ standardId: id });
    return NextResponse.json({ parameters });
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
    const { parameterDefinitionId, role, sortOrder } = body;

    if (!parameterDefinitionId || !role) {
      return NextResponse.json(
        { error: "parameterDefinitionId and role are required" },
        { status: 400 }
      );
    }

    const parameter = await standardRepository.addParameter({
      standardId: id,
      parameterDefinitionId,
      role,
      sortOrder,
    });

    return NextResponse.json({ parameter }, { status: 201 });
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
    const parameterDefinitionId = searchParams.get("parameterDefinitionId");

    if (!parameterDefinitionId) {
      return NextResponse.json(
        { error: "parameterDefinitionId query param is required" },
        { status: 400 }
      );
    }

    await standardRepository.removeParameter({
      standardId: id,
      parameterDefinitionId,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
