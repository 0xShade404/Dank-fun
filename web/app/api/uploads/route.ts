import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { tokenDrafts } from "@/lib/db/schema";
import { getSessionAddress } from "@/lib/auth";
import { isAddress } from "viem";
import { saveUploadedImage, ImageUploadError } from "@/lib/image-upload";

/**
 * Stores the token image + off-chain metadata a creator enters in /create, BEFORE the on-chain
 * createToken() call. Returns a metadataUri the client passes straight into the contract call;
 * the indexer (lib/chain/sync.ts) joins the on-chain TokenCreated event back to this draft by
 * id. Images land in public/uploads (fine for this single-instance MVP); production should swap
 * this for IPFS/Arweave + S3-compatible object storage, per docs/ARCHITECTURE.md.
 */
export async function POST(request: NextRequest) {
  const sessionAddress = await getSessionAddress();
  if (!sessionAddress) {
    return NextResponse.json({ error: "Connect and sign in first" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const name = String(form.get("name") ?? "").trim();
  const symbol = String(form.get("symbol") ?? "").trim();
  const description = String(form.get("description") ?? "").trim().slice(0, 1000);
  const twitter = String(form.get("twitter") ?? "").trim().slice(0, 200);
  const telegram = String(form.get("telegram") ?? "").trim().slice(0, 200);
  const website = String(form.get("website") ?? "").trim().slice(0, 200);
  const creatorAddress = String(form.get("creatorAddress") ?? "").trim();
  const image = form.get("image");

  if (!name || name.length > 64) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  if (!symbol || symbol.length > 16) return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  if (!isAddress(creatorAddress) || creatorAddress.toLowerCase() !== sessionAddress.toLowerCase()) {
    return NextResponse.json({ error: "creatorAddress must match the signed-in wallet" }, { status: 400 });
  }

  let imageUrl: string | null = null;
  if (image instanceof File) {
    try {
      imageUrl = await saveUploadedImage(image);
    } catch (err) {
      if (err instanceof ImageUploadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const draftId = randomUUID();
  await db.insert(tokenDrafts).values({
    id: draftId,
    name,
    symbol: symbol.toUpperCase(),
    description: description || null,
    imageUrl,
    twitter: twitter || null,
    telegram: telegram || null,
    website: website || null,
    creatorAddress: creatorAddress.toLowerCase(),
    createdAt: Math.floor(Date.now() / 1000),
  });

  return NextResponse.json({
    draftId,
    metadataUri: `${request.nextUrl.origin}/api/metadata/${draftId}`,
    imageUrl,
  });
}
