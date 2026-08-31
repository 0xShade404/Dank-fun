import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/layout/nav";

export const metadata: Metadata = {
  title: "dank.fun — DRC-20 Memecoin Factory",
  description: "Create, trade, and graduate DRC-20 memecoins on a simple bonding curve.",
  icons: { icon: "/wolf-logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-neutral-950 text-neutral-100">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-neutral-900 px-4 py-6 text-center text-xs text-neutral-600">
            dank.fun is an MVP demo. Tokens are unverified and not investment advice. Trading is risky — only
            spend what you can lose.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
