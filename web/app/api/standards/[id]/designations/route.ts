import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 50;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!, 10)
      : 0;
    const q = searchParams.get("q") ?? undefined;

    const [designations, total] = await Promise.all([
      standardRepository.listDesignations({ standardId: id, q, limit, offset }),
      standardRepository.countDesignations({ standardId: id }),
    ]);

    return NextResponse.json({ designations, total, limit, offset });
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
    const { designation, values, metadata } = body;

    if (!designation || !values) {
      return NextResponse.json(
        { error: "designation and values are required" },
        { status: 400 }
      );
    }

    const entry = await standardRepository.createDesignation({
      standardId: id,
      designation,
      values,
      metadata,
    });

    return NextResponse.json({ designation: entry }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const designationId = new URL(request.url).searchParams.get("id");
    if (!designationId) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }
    await standardRepository.removeDesignation({ id: designationId });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
