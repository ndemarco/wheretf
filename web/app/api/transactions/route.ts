import { NextRequest, NextResponse } from "next/server";
import { transactionRepository } from "@/repositories/transactionRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const transactions = await transactionRepository.listRecent({
      orgId: ctx.activeOrgId,
      limit,
    });
    return NextResponse.json({ transactions });
  } catch (err) {
    return errorResponse(err);
  }
}
