import { NextRequest, NextResponse } from "next/server";
import { listTokens, type TokenSort } from "@/lib/db/queries";

const VALID_SORTS: TokenSort[] = ["trending", "new", "near_graduation", "graduated", "volume", "market_cap"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sortParam = searchParams.get("sort") ?? "trending";
  const sort = (VALID_SORTS.includes(sortParam as TokenSort) ? sortParam : "trending") as TokenSort;
  const limit = Math.min(Number(searchParams.get("limit") ?? 40) || 40, 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);
  const creator = searchParams.get("creator") ?? undefined;

  const rows = await listTokens({ sort, limit, offset, creator });
  return NextResponse.json({ tokens: rows });
}
