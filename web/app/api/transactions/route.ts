import { NextRequest, NextResponse } from "next/server";
import { transactionRepository } from "@/repositories/transactionRepository";

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const transactions = await transactionRepository.listRecent({ limit });
    return NextResponse.json({ transactions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
