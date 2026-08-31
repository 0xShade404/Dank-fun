export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export interface BadgeInput {
  accountAgeSeconds: number;
  tokensCreated: number;
  tokensGraduated: number;
  tradeCount: number;
  hasProfile: boolean;
  portfolioValueNative: number; // approximate, threshold checks only -- never used for settlement
}

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * Every badge here is computed from data already indexed (trades, tokens, profile fields) --
 * there's no separate "badges" table to keep in sync. Pure function so it's trivial to unit
 * test and reuse between the profile page and any future badge display (leaderboards, etc).
 */
export function computeBadges(input: BadgeInput): Badge[] {
  const badges: Badge[] = [];

  if (input.tokensGraduated >= 1) {
    badges.push({
      id: "graduated-creator",
      label: "Graduated Creator",
      description: "Launched a token that graduated the curve.",
      icon: "🎓",
    });
  }
  if (input.tokensCreated >= 3) {
    badges.push({
      id: "serial-launcher",
      label: "Serial Launcher",
      description: `Launched ${input.tokensCreated} tokens.`,
      icon: "🚀",
    });
  }
  if (input.tradeCount >= 20) {
    badges.push({
      id: "active-trader",
      label: "Active Trader",
      description: `${input.tradeCount}+ trades on the curve.`,
      icon: "📈",
    });
  } else if (input.tradeCount >= 1) {
    badges.push({
      id: "first-trade",
      label: "First Trade",
      description: "Made their first trade.",
      icon: "🎯",
    });
  }
  if (input.accountAgeSeconds >= THIRTY_DAYS) {
    badges.push({
      id: "og",
      label: "OG",
      description: "Signed in over 30 days ago.",
      icon: "🐺",
    });
  }
  if (input.hasProfile) {
    badges.push({
      id: "verified-profile",
      label: "Verified Profile",
      description: "Completed their profile.",
      icon: "✅",
    });
  }
  if (input.portfolioValueNative >= 5) {
    badges.push({
      id: "whale",
      label: "Whale",
      description: "Holding 5+ native in open positions.",
      icon: "🐋",
    });
  }

  return badges;
}
