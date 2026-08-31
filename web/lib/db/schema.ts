import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * SQLite (via Drizzle) stands in for this MVP's Postgres + Redis indexing layer (see
 * docs/ARCHITECTURE.md). Every row here is derived from on-chain events -- nothing in this
 * database is a source of truth for balances, supply, or trade settlement; the chain is.
 */

/**
 * A pending token's off-chain metadata, created by the /create form BEFORE the on-chain
 * createToken() call. Its id is embedded in the metadataURI passed to the contract
 * (`/api/metadata/<id>`), so the indexer can join the on-chain TokenCreated event back to the
 * name/image/description/socials the creator entered without needing a separate IPFS fetch in
 * this MVP. Swap this whole flow for real IPFS/Arweave storage in production (see docs).
 */
export const tokenDrafts = sqliteTable("token_drafts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  twitter: text("twitter"),
  telegram: text("telegram"),
  website: text("website"),
  creatorAddress: text("creator_address").notNull(),
  createdAt: integer("created_at").notNull(),
  consumedAt: integer("consumed_at"),
});

export const users = sqliteTable("users", {
  address: text("address").primaryKey(), // lowercase 0x address
  nonce: text("nonce").notNull(),
  createdAt: integer("created_at").notNull(),
  lastLoginAt: integer("last_login_at"),

  // Profile fields. All optional -- a wallet has a usable profile (portfolio, creator stats,
  // badges) the moment it trades or creates a token, with zero setup. These are the only
  // fields a wallet can edit about itself, and only after proving ownership via the signed
  // session cookie (see app/api/profile/route.ts).
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  twitter: text("twitter"),
  telegram: text("telegram"),
  website: text("website"),
  profileUpdatedAt: integer("profile_updated_at"),
});

export const tokens = sqliteTable(
  "tokens",
  {
    address: text("address").primaryKey(), // lowercase 0x address of the DankToken
    marketAddress: text("market_address").notNull(),
    creatorAddress: text("creator_address").notNull(),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    imageUrl: text("image_url"),
    description: text("description"),
    twitter: text("twitter"),
    telegram: text("telegram"),
    website: text("website"),
    metadataUri: text("metadata_uri"),

    // Curve config snapshot at creation (protocol-standardized, but recorded per-token since
    // DankFactory.configureCurve can change defaults for *future* tokens).
    basePrice: text("base_price").notNull(), // bigint as string
    slope: text("slope").notNull(),
    curveSupplyCap: text("curve_supply_cap").notNull(),
    graduationReserve: text("graduation_reserve").notNull(),
    protocolFeeBps: integer("protocol_fee_bps").notNull(),

    // Live curve state, kept in sync with on-chain state by the sync routes.
    sold: text("sold").notNull().default("0"),
    reserveBalance: text("reserve_balance").notNull().default("0"),
    graduated: integer("graduated", { mode: "boolean" }).notNull().default(false),
    graduatedAt: integer("graduated_at"),

    createdAt: integer("created_at").notNull(),
    createdTxHash: text("created_tx_hash").notNull(),
    createdBlock: integer("created_block").notNull(),
  },
  (table) => [
    index("tokens_creator_idx").on(table.creatorAddress),
    index("tokens_created_at_idx").on(table.createdAt),
    index("tokens_graduated_idx").on(table.graduated),
  ]
);

export const trades = sqliteTable(
  "trades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenAddress: text("token_address").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    trader: text("trader").notNull(),
    side: text("side", { enum: ["buy", "sell"] }).notNull(),
    tokenAmount: text("token_amount").notNull(), // bigint as string, 18 decimals
    nativeAmount: text("native_amount").notNull(), // bigint as string, wei
    fee: text("fee").notNull(),
    soldAfter: text("sold_after").notNull(),
    spotPriceAfter: text("spot_price_after").notNull(),
    blockNumber: integer("block_number").notNull(),
    timestamp: integer("timestamp").notNull(),
  },
  (table) => [
    uniqueIndex("trades_tx_log_idx").on(table.txHash, table.logIndex),
    index("trades_token_idx").on(table.tokenAddress, table.timestamp),
    index("trades_trader_idx").on(table.trader),
  ]
);

export const holders = sqliteTable(
  "holders",
  {
    tokenAddress: text("token_address").notNull(),
    holderAddress: text("holder_address").notNull(),
    balance: text("balance").notNull(), // bigint as string, 18 decimals
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("holders_token_holder_idx").on(table.tokenAddress, table.holderAddress),
    index("holders_token_idx").on(table.tokenAddress),
  ]
);

export const liquidityEvents = sqliteTable("liquidity_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenAddress: text("token_address").notNull(),
  txHash: text("tx_hash").notNull(),
  nativeAmount: text("native_amount").notNull(),
  tokenAmount: text("token_amount").notNull(),
  timestamp: integer("timestamp").notNull(),
});

export const curveSnapshots = sqliteTable(
  "curve_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenAddress: text("token_address").notNull(),
    timestamp: integer("timestamp").notNull(),
    sold: text("sold").notNull(),
    spotPrice: text("spot_price").notNull(),
    nativeRaised: text("native_raised").notNull(),
    marketCapNative: real("market_cap_native").notNull(),
  },
  (table) => [index("curve_snapshots_token_idx").on(table.tokenAddress, table.timestamp)]
);

export const alerts = sqliteTable(
  "alerts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenAddress: text("token_address").notNull(),
    type: text("type", {
      enum: [
        "new_token",
        "first_buy",
        "large_buy",
        "large_sell",
        "rapid_volume",
        "graduation",
        "liquidity_migrated",
      ],
    }).notNull(),
    message: text("message").notNull(),
    payload: text("payload"), // JSON string
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("alerts_created_at_idx").on(table.createdAt), index("alerts_token_idx").on(table.tokenAddress)]
);
