import { createPublicClient, http } from "viem";
import { appChain } from "./config";

export const publicClient = createPublicClient({
  chain: appChain,
  transport: http(),
});
