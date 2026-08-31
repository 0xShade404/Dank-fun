import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/layout/nav";

export const metadata: Metadata = {
  title: "dank.fun — DRC-20 Memecoin Factory",
  description: "Create, trade, and graduate DRC-20 memecoins on a simple bonding curve.",
  icons: { icon: "/wolf-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#080a09",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full bg-background antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border bg-background px-4 py-8 text-center text-xs leading-6 text-muted-foreground">
            <p>dank.fun is an MVP demo. Tokens are unverified and not investment advice.</p>
            <p>Trading is risky — only spend what you can afford to lose.</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
