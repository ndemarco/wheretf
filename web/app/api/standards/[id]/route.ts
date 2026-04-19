import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const standard = await standardRepository.findById({
      orgId: ctx.activeOrgId,
      id,
    });
    if (!standard) {
      return NextResponse.json({ error: "Standard not found" }, { status: 404 });
    }

    const [parameters, aspects, itemCount, designationCount, items, designationUsage] =
      await Promise.all([
        standardRepository.getParameters({
          orgId: ctx.activeOrgId,
          standardId: id,
        }),
        standardRepository.listAspectsForStandard({
          orgId: ctx.activeOrgId,
          standardId: id,
        }),
        standardRepository.countItemsUsing({
          orgId: ctx.activeOrgId,
          standardId: id,
        }),
        standardRepository.countDesignations({
          orgId: ctx.activeOrgId,
          standardId: id,
        }),
        standardRepository.listItemsUsing({
          orgId: ctx.activeOrgId,
          standardId: id,
          limit: 50,
        }),
        standardRepository.designationUsage({
          orgId: ctx.activeOrgId,
          standardId: id,
        }),
      ]);

    return NextResponse.json({
      standard,
      parameters,
      aspects,
      itemCount,
      designationCount,
      items,
      designationUsage,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const standard = await standardRepository.update({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
      ...body,
    });
    return NextResponse.json({ standard });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    await standardRepository.remove({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
