import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const standard = await standardRepository.findById({ id });
    if (!standard) {
      return NextResponse.json({ error: "Standard not found" }, { status: 404 });
    }

    const [parameters, aspects, itemCount, designationCount, items, designationUsage] =
      await Promise.all([
        standardRepository.getParameters({ standardId: id }),
        standardRepository.listAspectsForStandard({ standardId: id }),
        standardRepository.countItemsUsing({ standardId: id }),
        standardRepository.countDesignations({ standardId: id }),
        standardRepository.listItemsUsing({ standardId: id, limit: 50 }),
        standardRepository.designationUsage({ standardId: id }),
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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const standard = await standardRepository.update({ id, ...body });
    return NextResponse.json({ standard });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await standardRepository.remove({ id });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
