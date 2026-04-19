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

    const versions = await templateRepository.listVersions({
      orgId: ctx.activeOrgId,
      templateId: id,
    });
    return NextResponse.json({ versions });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();

    const version = await templateRepository.publishVersion({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      templateId: id,
      ...body,
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
