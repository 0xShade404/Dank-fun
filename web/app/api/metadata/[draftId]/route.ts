import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tokenDrafts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const [draft] = await db.select().from(tokenDrafts).where(eq(tokenDrafts.id, draftId)).limit(1);

  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: draft.name,
    symbol: draft.symbol,
    description: draft.description,
    image: draft.imageUrl ? new URL(draft.imageUrl, request.nextUrl.origin).toString() : null,
    external_url: `${request.nextUrl.origin}/dank/${draft.id}`,
    creator: draft.creatorAddress,
    socials: {
      twitter: draft.twitter,
      telegram: draft.telegram,
      website: draft.website,
    },
  });
}
