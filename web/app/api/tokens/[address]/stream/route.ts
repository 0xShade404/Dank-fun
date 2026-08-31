import { db } from "@/lib/db/client";
import { trades } from "@/lib/db/schema";
import { and, eq, gt, desc, asc } from "drizzle-orm";
import { createPollingSSEStream, SSE_BATCH_LIMIT } from "@/lib/sse";

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const tokenAddress = address.toLowerCase();

  return createPollingSSEStream(
    async (sinceId) => {
      const rows = await db
        .select()
        .from(trades)
        .where(and(eq(trades.tokenAddress, tokenAddress), gt(trades.id, sinceId)))
        .orderBy(asc(trades.id))
        .limit(SSE_BATCH_LIMIT);
      return rows.map((row) => ({ id: row.id, row }));
    },
    async () => {
      const [latest] = await db
        .select({ id: trades.id })
        .from(trades)
        .where(eq(trades.tokenAddress, tokenAddress))
        .orderBy(desc(trades.id))
        .limit(1);
      return latest?.id ?? 0;
    }
  );
}
