import { NextRequest, NextResponse } from "next/server";
import { templateRepository } from "@/repositories/templateRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const includeHidden =
      request.nextUrl.searchParams.get("includeHidden") === "true";
    const templates = await templateRepository.listWithCurrentVersion({
      orgId: ctx.activeOrgId,
      includeHidden,
    });
    return NextResponse.json({ templates });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { name, description, metadata, asGlobal, ...versionFields } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const template = await templateRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      asGlobal: Boolean(asGlobal),
      name,
      description,
      metadata,
      ...versionFields,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
