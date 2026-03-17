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

    const versions = await templateRepository.listVersions({ templateId: id });
    return NextResponse.json({ versions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const version = await templateRepository.publishVersion({
      templateId: id,
      ...body,
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
