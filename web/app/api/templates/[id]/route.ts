import { NextRequest, NextResponse } from "next/server";
import { templateRepository } from "@/repositories/templateRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const template = await templateRepository.findById({
      orgId: ctx.activeOrgId,
      id,
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const { name, description, metadata, activeVersion } = body;

    if (activeVersion !== undefined) {
      await templateRepository.setActiveVersion({
        userId: ctx.userId,
        orgId: ctx.activeOrgId,
        templateId: id,
        version: activeVersion,
      });
    }

    const template = await templateRepository.update({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(metadata !== undefined && { metadata }),
    });

    return NextResponse.json({ template });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;

    const refs = await templateRepository.getReferenceCount({
      orgId: ctx.activeOrgId,
      id,
    });
    if (refs.insertCount > 0 || refs.locationCount > 0) {
      return NextResponse.json(
        {
          error: "Template is referenced and cannot be deleted. Hide it instead.",
          references: refs,
        },
        { status: 409 },
      );
    }

    await templateRepository.remove({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
