import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";

export async function GET() {
  try {
    const items = await standardRepository.list();
    return NextResponse.json({ standards: items });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, domainTag, aspectIds } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const standard = await standardRepository.create({
      name,
      description,
      domainTag,
    });

    if (Array.isArray(aspectIds) && aspectIds.length > 0) {
      for (const aspectId of aspectIds) {
        await standardRepository.addAspect({
          standardId: standard.id,
          aspectId,
        });
      }
    }

    return NextResponse.json({ standard }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
