import { db } from "@/lib/db/client";
import { trades } from "@/lib/db/schema";
import { and, eq, gt, desc } from "drizzle-orm";
import { createPollingSSEStream } from "@/lib/sse";

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const tokenAddress = address.toLowerCase();

  return createPollingSSEStream(async (sinceId) => {
    const rows = await db
      .select()
      .from(trades)
      .where(and(eq(trades.tokenAddress, tokenAddress), gt(trades.id, sinceId)))
      .orderBy(desc(trades.id))
      .limit(50);
    return rows.reverse().map((row) => ({ id: row.id, row }));
  });
}
