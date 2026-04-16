import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const aspects = await itemRepository.getAspects({ itemId: id });
    return NextResponse.json({ aspects });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { aspectId } = await request.json();
    const itemAspect = await itemRepository.applyAspect({
      itemId: id,
      aspectId,
    });
    return NextResponse.json({ itemAspect }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { aspectId } = await request.json();
    await itemRepository.removeAspect({ itemId: id, aspectId });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not applied")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
