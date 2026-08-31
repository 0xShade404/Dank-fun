"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button";
import { SearchBox } from "@/components/layout/search-box";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/alerts", label: "Alerts" },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-5">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg" aria-label="dank.fun home">
          <Image src="/wolf-logo.png" alt="dank.fun" width={32} height={32} className="rounded-full" />
          <span className="text-lg font-black tracking-tight text-foreground">dank<span className="text-primary">.fun</span></span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${isActive(link.href) ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <SearchBox />
          <Link href="/create" className="hidden min-h-11 items-center rounded-full border border-primary/40 px-4 text-sm font-semibold text-primary transition hover:bg-primary/10 sm:inline-flex">Create token</Link>
          <WalletConnectButton />
        </div>
      </div>
      <nav className="mobile-scroll flex items-center gap-1 overflow-x-auto border-t border-border/70 px-4 py-2 md:hidden" aria-label="Mobile navigation">
        {LINKS.concat([{ href: "/create", label: "Create" }]).map((link) => (
          <Link key={link.href} href={link.href} className={`flex min-h-11 shrink-0 items-center rounded-lg px-3 text-xs font-semibold ${isActive(link.href) ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
