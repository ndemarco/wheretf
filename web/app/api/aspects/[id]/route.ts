import { NextRequest, NextResponse } from "next/server";
import { aspectRepository } from "@/repositories/aspectRepository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const aspect = await aspectRepository.findById({ id });
    if (!aspect) {
      return NextResponse.json({ error: "Aspect not found" }, { status: 404 });
    }
    const [usage, parameters] = await Promise.all([
      aspectRepository.getUsage({ aspectId: id }),
      aspectRepository.getParameters({ aspectId: id }),
    ]);
    return NextResponse.json({
      aspect,
      parameters,
      itemCount: usage.itemCount,
      parameterCount: usage.parameterCount,
      standardCount: usage.standardCount,
    });
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
    const aspect = await aspectRepository.update({ id, ...body });
    return NextResponse.json({ aspect });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
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
    await aspectRepository.remove({ id });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
