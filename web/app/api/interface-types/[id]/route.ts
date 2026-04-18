import { NextRequest, NextResponse } from "next/server";
import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const interfaceType = await interfaceTypeRepository.findById({ id });
    if (!interfaceType) {
      return NextResponse.json(
        { error: "Interface type not found" },
        { status: 404 },
      );
    }
    const usage = await interfaceTypeRepository.usageCount({ id });
    return NextResponse.json({ interfaceType, usage });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const interfaceType = await interfaceTypeRepository.update({
      id,
      ...body,
    });
    return NextResponse.json({ interfaceType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    // Demotion stable→draft + other invariants return 409 conflict so
    // clients can distinguish rule violations from bad input.
    if (message.includes("terminal") || message.includes("one-way")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await interfaceTypeRepository.remove({ id });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    // Archive-gate + usage-gate return 409.
    if (message.includes("not archived") || message.includes("in use")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
