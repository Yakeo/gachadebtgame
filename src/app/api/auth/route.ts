import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { saves, users } from "@/db/schema";
import { checkAuthLimit, currentUser, hashPassword, logout, newSession, publicPlayer, validateOrigin, verifyPassword } from "@/lib/auth";
import { initialState } from "@/lib/game-data";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) }); }
export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const input = await request.json() as Record<string, unknown>;
    if (input.action === "logout") { await logout(); return NextResponse.json({ ok: true }); }
    await checkAuthLimit(request);
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Please enter a valid email address.");
    if (password.length < 8 || password.length > 128) throw new Error("Use a password between 8 and 128 characters.");
    let user: typeof users.$inferSelect;
    if (input.action === "register") {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (name.length < 2 || name.length > 24) throw new Error("Your display name should be 2–24 characters.");
      const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (exists) throw new Error("An account with this email already exists. Please sign in.");
      const current = await currentUser();
      if (current && !current.guest) throw new Error("Sign out before creating another account.");
      const passwordHash = await hashPassword(password);
      user = await db.transaction(async tx => {
        if (current?.guest) {
          const [updated] = await tx.update(users).set({ name, email, passwordHash, guest: false }).where(and(eq(users.id, current.id), eq(users.guest, true))).returning();
          if (!updated) throw new Error("Account changed. Please refresh and try again.");
          return updated;
        }
        const [created] = await tx.insert(users).values({ name, email, passwordHash, guest: false }).returning();
        await tx.insert(saves).values({ userId: created.id, data: initialState() });
        return created;
      });
    } else if (input.action === "login") {
      const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!found?.passwordHash || !(await verifyPassword(password, found.passwordHash))) throw new Error("Email or password is incorrect. Google accounts should use Google sign-in.");
      user = found;
    } else throw new Error("Unknown account action.");
    await newSession(user.id);
    const [save] = await db.select().from(saves).where(eq(saves.userId, user.id)).limit(1);
    return NextResponse.json({ player: publicPlayer(user), state: save.data });
  } catch (error) {
    const message = error instanceof Error && !error.message.includes("query:") ? error.message : "Unable to save your account. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
