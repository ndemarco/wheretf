import { NextRequest, NextResponse } from "next/server";
import { templateRepository } from "@/repositories/templateRepository";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const template = await templateRepository.findById({ id });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    const refs = await templateRepository.getReferenceCount({ id });
    return NextResponse.json({
      stats: {
        ...refs,
        isHidden: template.isHidden,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
