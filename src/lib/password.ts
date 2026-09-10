import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEYLEN = 64;

/** Hash a password with scrypt + salt (Node built-in, no native deps). */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return { hash, salt };
}

/** Verify a password against stored hash+salt. */
export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const derived = scryptSync(password, salt, KEYLEN);
    const stored = Buffer.from(storedHash, "hex");
    if (derived.length !== stored.length) return false;
    return timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

export const DEMO_SALT = "demo-salt-0000000000000000";
/**
 * Precomputed scrypt("123456", DEMO_SALT, 64) — deterministic, so demo
 * accounts always share the same hash without paying for a key derivation on
 * every module import (which crashed Next.js build workers on some machines).
 */
export const DEMO_HASH =
  "ce0d08726940b52751d16f8c27feef44aef8108b109c5447f1fa780fa7297a65435ba314eefbfbf175eabd222146e6e90fb14adba8751a358501652a128def2a";

/** Deterministic hash for demo seeds (all demo accounts use password "123456"). */
export function demoHash(): { hash: string; salt: string } {
  return { hash: DEMO_HASH, salt: DEMO_SALT };
}