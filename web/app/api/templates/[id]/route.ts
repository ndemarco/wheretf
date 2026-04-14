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
    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, metadata, activeVersion } = body;

    // Set active version if requested
    if (activeVersion !== undefined) {
      await templateRepository.setActiveVersion({
        templateId: id,
        version: activeVersion,
      });
    }

    const template = await templateRepository.update({
      id,
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(metadata !== undefined && { metadata }),
    });

    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // If the template is referenced anywhere, reject hard delete and
    // tell the caller to hide instead.
    const refs = await templateRepository.getReferenceCount({ id });
    if (refs.insertCount > 0 || refs.locationCount > 0) {
      return NextResponse.json(
        {
          error: "Template is referenced and cannot be deleted. Hide it instead.",
          references: refs,
        },
        { status: 409 }
      );
    }

    await templateRepository.remove({ id });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
