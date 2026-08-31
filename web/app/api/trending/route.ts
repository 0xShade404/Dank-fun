import { NextResponse } from "next/server";
import { listTokens } from "@/lib/db/queries";

/** Home-page discovery buckets, per spec section 7. */
export async function GET() {
  const [trending, fresh, nearGraduation, graduated, volume] = await Promise.all([
    listTokens({ sort: "trending", limit: 10 }),
    listTokens({ sort: "new", limit: 10 }),
    listTokens({ sort: "near_graduation", limit: 10 }),
    listTokens({ sort: "graduated", limit: 10 }),
    listTokens({ sort: "volume", limit: 10 }),
  ]);

  return NextResponse.json({
    trending,
    new: fresh,
    nearGraduation,
    recentlyGraduated: graduated,
    highestVolume: volume,
  });
}
