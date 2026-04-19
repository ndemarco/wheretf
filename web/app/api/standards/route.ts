import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET() {
  try {
    const ctx = await requireContext();
    const items = await standardRepository.list({ orgId: ctx.activeOrgId });
    return NextResponse.json({ standards: items });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { name, description, domainTag, asGlobal, aspectIds } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const standard = await standardRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      asGlobal: Boolean(asGlobal),
      name,
      description,
      domainTag,
    });

    if (Array.isArray(aspectIds) && aspectIds.length > 0) {
      for (const aspectId of aspectIds) {
        await standardRepository.addAspect({
          userId: ctx.userId,
          orgId: ctx.activeOrgId,
          standardId: standard.id,
          aspectId,
        });
      }
    }

    return NextResponse.json({ standard }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
