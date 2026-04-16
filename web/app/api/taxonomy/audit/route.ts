import { NextResponse } from "next/server";
import { aspectRepository } from "@/repositories/aspectRepository";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { itemRepository } from "@/repositories/itemRepository";

export async function GET() {
  try {
    const [paramChecks, aspectChecks, valueChecks] = await Promise.all([
      parameterDefinitionRepository.audit(),
      aspectRepository.audit(),
      itemRepository.auditParameterValues(),
    ]);
    const checks = [...paramChecks, ...aspectChecks, ...valueChecks];
    return NextResponse.json({
      checks,
      runAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
