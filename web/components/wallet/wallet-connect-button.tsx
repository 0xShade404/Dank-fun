"use client";

import { useState } from "react";
import { useConnection, useConnect, useDisconnect } from "wagmi";
import { useSession } from "./session-context";

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { address, isConnected } = useConnection();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { sessionAddress, isSigningIn, signIn, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isConnected || !address) {
    const injectedConnector = connectors[0];
    return (
      <button
        onClick={() => injectedConnector && connect({ connector: injectedConnector })}
        disabled={isConnecting || !injectedConnector}
        className="rounded-full bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:opacity-50"
      >
        {isConnecting ? "Connecting…" : injectedConnector ? "Connect Wallet" : "No wallet found"}
      </button>
    );
  }

  if (!sessionAddress || sessionAddress.toLowerCase() !== address.toLowerCase()) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-neutral-400 sm:inline">{short(address)}</span>
        <button
          onClick={() => signIn()}
          disabled={isSigningIn}
          className="rounded-full bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:opacity-50"
        >
          {isSigningIn ? "Sign in your wallet…" : "Sign In"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-500"
      >
        <span className="h-2 w-2 rounded-full bg-lime-400" />
        {short(address)}
      </button>
      {menuOpen && (
        <div
          className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <a href={`/profile/${address}`} className="block px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800">
            My profile
          </a>
          <button
            onClick={() => {
              setMenuOpen(false);
              signOut();
              disconnect();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-neutral-800"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
