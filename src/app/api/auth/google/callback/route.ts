import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { saves, users } from "@/db/schema";
import { currentUser, newSession } from "@/lib/auth";
import { initialState } from "@/lib/game-data";
export async function GET(request: NextRequest) {
  const origin = (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
  const jar = await cookies();
  const stored = jar.get("gd_oauth")?.value;
  jar.delete("gd_oauth");
  try {
    const [state, verifier] = stored?.split(".") || [];
    const code = request.nextUrl.searchParams.get("code");
    if (!state || !verifier || request.nextUrl.searchParams.get("state") !== state || !code) throw new Error("Invalid OAuth state");
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Error("OAuth not configured");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: verifier }), signal: AbortSignal.timeout(15000) });
    if (!tokenResponse.ok) throw new Error("Token exchange failed");
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string") throw new Error("Missing access token");
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!response.ok) throw new Error("Profile request failed");
    const profile = await response.json();
    if (typeof profile.sub !== "string" || typeof profile.email !== "string" || profile.email_verified !== true) throw new Error("Verified Google identity required");
    const email = profile.email.toLowerCase();
    let [user] = await db.select().from(users).where(eq(users.googleId, profile.sub)).limit(1);
    if (!user) {
      const current = await currentUser();
      const [emailOwner] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (emailOwner && current?.id !== emailOwner.id) return NextResponse.redirect(new URL("/?authError=email-exists", origin));
      user = await db.transaction(async tx => {
        const values = { email, googleId: profile.sub as string, guest: false, name: typeof profile.name === "string" ? profile.name.slice(0, 24) : "President" };
        if (emailOwner) { const [linked] = await tx.update(users).set({ googleId: profile.sub }).where(eq(users.id, emailOwner.id)).returning(); return linked; }
        if (current?.guest) { const [upgraded] = await tx.update(users).set(values).where(eq(users.id, current.id)).returning(); return upgraded; }
        const [created] = await tx.insert(users).values(values).returning();
        await tx.insert(saves).values({ userId: created.id, data: initialState() });
        return created;
      });
    }
    await newSession(user.id);
    return NextResponse.redirect(new URL("/?signedIn=1", origin));
  } catch (error) { console.error("Google sign-in:", error instanceof Error ? error.message : "Unknown error"); return NextResponse.redirect(new URL("/?authError=google-sign-in-failed", origin)); }
}
