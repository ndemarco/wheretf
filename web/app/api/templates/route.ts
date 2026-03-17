import { NextRequest, NextResponse } from "next/server";
import { templateRepository } from "@/repositories/templateRepository";

export async function GET() {
  try {
    const templates = await templateRepository.list();
    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, metadata, version } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const template = await templateRepository.create({
      name,
      description,
      metadata,
    });

    // If version fields were provided, publish them as a new version
    // (version 1 is auto-created with defaults by the repository)
    if (version && Object.keys(version).length > 0) {
      await templateRepository.publishVersion({
        templateId: template.id,
        ...version,
      });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
