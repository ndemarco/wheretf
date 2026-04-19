import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
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
      standardRepository.listDesignations({
        orgId: ctx.activeOrgId,
        standardId: id,
        q,
        limit,
        offset,
      }),
      standardRepository.countDesignations({
        orgId: ctx.activeOrgId,
        standardId: id,
      }),
    ]);

    return NextResponse.json({ designations, total, limit, offset });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
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
      orgId: ctx.activeOrgId,
      standardId: id,
      designation,
      values,
      metadata,
    });

    return NextResponse.json({ designation: entry }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const designationId = new URL(request.url).searchParams.get("id");
    if (!designationId) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }
    await standardRepository.removeDesignation({
      orgId: ctx.activeOrgId,
      id: designationId,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
