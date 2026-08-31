import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db/client";
import { tokenDrafts } from "@/lib/db/schema";
import { getSessionAddress } from "@/lib/auth";
import { isAddress } from "viem";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

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
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large (max 3MB)" }, { status: 400 });
    }
    const ext = ALLOWED_MIME[image.type];
    if (!ext) {
      return NextResponse.json({ error: "Unsupported image type (png/jpeg/gif/webp only)" }, { status: 400 });
    }
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await image.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, filename), bytes);
    imageUrl = `/uploads/${filename}`;
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
