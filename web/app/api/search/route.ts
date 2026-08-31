import { NextRequest, NextResponse } from "next/server";
import { searchTokens } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ tokens: [] });
  const rows = await searchTokens(q, 20);
  return NextResponse.json({ tokens: rows });
}
