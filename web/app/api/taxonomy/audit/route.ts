import { NextResponse } from "next/server";
import { aspectRepository } from "@/repositories/aspectRepository";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { itemRepository } from "@/repositories/itemRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET() {
  try {
    const ctx = await requireContext();
    const [paramChecks, aspectChecks, valueChecks] = await Promise.all([
      parameterDefinitionRepository.audit({ orgId: ctx.activeOrgId }),
      aspectRepository.audit({ orgId: ctx.activeOrgId }),
      itemRepository.auditParameterValues({ orgId: ctx.activeOrgId }),
    ]);
    const checks = [...paramChecks, ...aspectChecks, ...valueChecks];
    return NextResponse.json({
      checks,
      runAt: new Date().toISOString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
