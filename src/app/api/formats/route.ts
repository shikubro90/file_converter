import { NextRequest, NextResponse } from "next/server";
import { FORMAT_MAP } from "@/lib/formatMap";

export async function GET(req: NextRequest) {
  const mime = req.nextUrl.searchParams.get("mime");

  if (!mime) {
    return NextResponse.json({ error: "Missing mime query parameter" }, { status: 400 });
  }

  const targets = FORMAT_MAP.get(mime) ?? [];
  return NextResponse.json({ targets });
}
