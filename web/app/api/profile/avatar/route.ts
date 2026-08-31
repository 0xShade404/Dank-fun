import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionAddress } from "@/lib/auth";
import { saveUploadedImage, ImageUploadError } from "@/lib/image-upload";

export async function POST(request: NextRequest) {
  const address = await getSessionAddress();
  if (!address) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  let avatarUrl: string;
  try {
    avatarUrl = await saveUploadedImage(image);
  } catch (err) {
    if (err instanceof ImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  await db
    .update(users)
    .set({ avatarUrl, profileUpdatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.address, address));

  return NextResponse.json({ avatarUrl });
}
