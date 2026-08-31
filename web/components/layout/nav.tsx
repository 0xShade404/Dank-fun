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

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/wolf-logo.png" alt="dank.fun" width={32} height={32} className="rounded-full" />
          <span className="text-lg font-black tracking-tight text-neutral-50">
            dank<span className="text-lime-400">.fun</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname.startsWith(link.href)
                  ? "bg-neutral-900 text-lime-400"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SearchBox />
          <Link
            href="/create"
            className="hidden rounded-full border border-lime-400/40 px-4 py-2 text-sm font-semibold text-lime-400 transition hover:bg-lime-400/10 sm:inline-block"
          >
            + Create
          </Link>
          <WalletConnectButton />
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-neutral-900 px-4 py-1.5 md:hidden">
        {LINKS.concat([{ href: "/create", label: "Create" }]).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-lg px-3 py-1 text-xs font-medium text-neutral-400 hover:text-neutral-100"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
