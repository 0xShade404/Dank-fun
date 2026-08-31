import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Wallet-based auth: connect wallet -> server issues a nonce -> user signs a message containing
 * that nonce -> backend verifies the signature -> a session cookie is issued. No seed phrases or
 * private keys ever touch the server.
 *
 * Sessions are a signed, stateless HMAC token (not a DB-backed session table) to keep the MVP's
 * schema small; the secret should be set via SESSION_SECRET in production.
 */

const SESSION_COOKIE = "dank_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
}

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

// Deterministic by design (no timestamp): the client must be able to reconstruct the exact
// message it signed, and the server must be able to reconstruct the exact message to verify
// against, from address + nonce alone. The nonce (rotated on every successful verify) is what
// prevents replay, not a timestamp.
export function buildSignInMessage(address: string, nonce: string): string {
  return ["dank.fun wants you to sign in with your wallet.", "", `Address: ${address}`, `Nonce: ${nonce}`].join(
    "\n"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function issueSessionToken(address: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${address.toLowerCase()}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): { address: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [address, expStr, signature] = parts;
  const payload = `${address}.${expStr}`;
  const expected = sign(payload);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  return { address };
}

export async function getSessionAddress(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token)?.address ?? null;
}

export async function setSessionCookie(address: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, issueSessionToken(address), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
