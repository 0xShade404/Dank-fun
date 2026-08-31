import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { indexerState } from "@/lib/db/schema";
import { publicClient } from "./client";
import { FACTORY_ADDRESS, appChain } from "./config";
import { syncTransaction } from "./sync";

const STATE_ID = `dogechain-${appChain.id}`;
const startBlock = Number(process.env.INDEXER_START_BLOCK ?? 0);
const confirmations = Math.max(0, Number(process.env.INDEXER_CONFIRMATIONS ?? 12));
const batchSize = Math.min(2_000, Math.max(1, Number(process.env.INDEXER_BATCH_SIZE ?? 500)));

export async function processIndexerBatch() {
  const head = await publicClient.getBlockNumber();
  const safeHead = head - BigInt(confirmations);
  if (safeHead < 0n) return { processed: 0, nextBlock: startBlock, head: head.toString() };

  const [state] = await db.select().from(indexerState).where(eq(indexerState.id, STATE_ID)).limit(1);
  const next = state?.nextBlock ?? startBlock;
  if (BigInt(next) > safeHead) return { processed: 0, nextBlock: next, head: head.toString() };

  const toBlock = Math.min(next + batchSize - 1, Number(safeHead));
  const logs = await publicClient.getLogs({ address: FACTORY_ADDRESS, fromBlock: BigInt(next), toBlock: BigInt(toBlock) });
  const hashes = [...new Set(logs.map((log) => log.transactionHash).filter((hash): hash is `0x${string}` => Boolean(hash)))];
  for (const hash of hashes) await syncTransaction(hash);

  const block = await publicClient.getBlock({ blockNumber: BigInt(toBlock) });
  const updatedAt = Math.floor(Date.now() / 1000);
  if (state) {
    await db.update(indexerState).set({ nextBlock: toBlock + 1, lastProcessedHash: block.hash, updatedAt }).where(eq(indexerState.id, STATE_ID));
  } else {
    await db.insert(indexerState).values({ id: STATE_ID, nextBlock: toBlock + 1, lastProcessedHash: block.hash, updatedAt });
  }
  return { processed: hashes.length, fromBlock: next, toBlock, nextBlock: toBlock + 1, head: head.toString() };
}

export function indexerConfig() { return { chainId: appChain.id, confirmations, batchSize, startBlock, stateId: STATE_ID }; }
