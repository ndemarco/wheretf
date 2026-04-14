import { NextRequest, NextResponse } from "next/server";
import { templateRepository } from "@/repositories/templateRepository";

export async function GET(request: NextRequest) {
  try {
    const includeHidden =
      request.nextUrl.searchParams.get("includeHidden") === "true";
    const templates = await templateRepository.listWithCurrentVersion({
      includeHidden,
    });
    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, metadata, ...versionFields } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const template = await templateRepository.create({
      name,
      description,
      metadata,
      ...versionFields,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
