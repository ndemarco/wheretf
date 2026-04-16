import { NextRequest, NextResponse } from "next/server";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usage = await parameterDefinitionRepository.getUsage({
      parameterDefinitionId: id,
    });
    return NextResponse.json(usage);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
