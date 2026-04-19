import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const parameters = await itemRepository.getParameterValues({
      orgId: ctx.activeOrgId,
      itemId: id,
    });
    return NextResponse.json({ parameters });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const parameter = await itemRepository.setParameterValue({
      orgId: ctx.activeOrgId,
      itemId: id,
      parameterDefinitionId: body.parameterDefinitionId,
      itemAspectId: body.itemAspectId,
      value: body.value,
    });
    return NextResponse.json({ parameter }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
