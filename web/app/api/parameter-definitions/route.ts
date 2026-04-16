import { NextRequest, NextResponse } from "next/server";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";

export async function GET() {
  try {
    const parameterDefinitions =
      await parameterDefinitionRepository.listWithUsage();
    return NextResponse.json({ parameterDefinitions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parameterDefinition = await parameterDefinitionRepository.create(body);
    return NextResponse.json({ parameterDefinition }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 400 },
    );
  }
}
