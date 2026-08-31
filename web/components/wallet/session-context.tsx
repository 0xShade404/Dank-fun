"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useConnection, useDisconnect, useSignMessage } from "wagmi";

interface SessionContextValue {
  sessionAddress: string | null;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useConnection();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  // What the server last confirmed via the signed cookie -- not necessarily the *currently
  // connected* wallet (the user may have switched or disconnected since). The derived
  // `sessionAddress` below is what components should actually treat as "signed in".
  const [confirmedSessionAddress, setConfirmedSessionAddress] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setConfirmedSessionAddress(data.address ?? null);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const sessionAddress =
    isConnected && address && confirmedSessionAddress && confirmedSessionAddress.toLowerCase() === address.toLowerCase()
      ? confirmedSessionAddress
      : null;

  const signIn = useCallback(async () => {
    if (!address) return;
    setIsSigningIn(true);
    try {
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!nonceRes.ok) throw new Error("Failed to get nonce");
      const { message } = await nonceRes.json();

      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      if (!verifyRes.ok) throw new Error("Signature verification failed");
      const data = await verifyRes.json();
      setConfirmedSessionAddress(data.address);
    } finally {
      setIsSigningIn(false);
    }
  }, [address, signMessageAsync]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setConfirmedSessionAddress(null);
    disconnect();
  }, [disconnect]);

  const value = useMemo(
    () => ({ sessionAddress, isSigningIn, signIn, signOut }),
    [sessionAddress, isSigningIn, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
