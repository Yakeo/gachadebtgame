import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { authLimits, saves, sessions, users } from "@/db/schema";
import { initialState } from "@/lib/game-data";
const scryptAsync = promisify(scrypt);
const COOKIE = "gd_session";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); const key = await scryptAsync(password, salt, 64) as Buffer; return `${salt}:${key.toString("hex")}`; }
export async function verifyPassword(password: string, encoded: string) { const [salt, key] = encoded.split(":"); if (!salt || !key) return false; const actual = await scryptAsync(password, salt, 64) as Buffer; const expected = Buffer.from(key, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected); }
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [result] = await db.select({ user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.token, hash(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return result?.user ?? null;
}
export function publicPlayer(user: typeof users.$inferSelect) { return { id: user.id, name: user.name, email: user.email, guest: user.guest }; }
export async function newSession(userId: string) {
  const jar = await cookies(); const old = jar.get(COOKIE)?.value;
  if (old) await db.delete(sessions).where(eq(sessions.token, hash(old)));
  const token = randomBytes(32).toString("hex");
  const maxAge = 60 * 60 * 24 * 30;
  await db.insert(sessions).values({ token: hash(token), userId, expiresAt: new Date(Date.now() + maxAge * 1000) });
  const h = await headers();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: h.get("x-forwarded-proto") === "https", path: "/", maxAge });
}
export async function logout() { const jar = await cookies(); const token = jar.get(COOKIE)?.value; if (token) await db.delete(sessions).where(eq(sessions.token, hash(token))); jar.delete(COOKIE); }
export async function createGuest() {
  const user = await db.transaction(async tx => {
    const [u] = await tx.insert(users).values({ name: "President", guest: true }).returning();
    await tx.insert(saves).values({ userId: u.id, data: initialState() });
    return u;
  });
  await newSession(user.id);
  return user;
}
export function validateOrigin(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("JSON requests only.");
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (origin && new URL(origin).host !== host && new URL(origin).host !== new URL(request.url).host) throw new Error("Request origin not allowed.");
}
export async function checkAuthLimit(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = hash(`auth:${ip}`);
  const resetAt = new Date(Date.now() + 10 * 60 * 1000);
  const [row] = await db.insert(authLimits).values({ key, resetAt }).onConflictDoUpdate({ target: authLimits.key, set: { attempts: sql`case when ${authLimits.resetAt} < now() then 1 else ${authLimits.attempts} + 1 end`, resetAt: sql`case when ${authLimits.resetAt} < now() then ${resetAt}::timestamp else ${authLimits.resetAt} end` } }).returning();
  if (row.attempts > 20) throw new Error("Too many attempts. Please try again in ten minutes.");
}
