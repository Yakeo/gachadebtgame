import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = process.env.APP_URL || request.nextUrl.origin;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.redirect(new URL("/?authError=google-not-configured", origin));
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  (await cookies()).set("gd_oauth", `${state}.${verifier}`, { httpOnly: true, secure: request.headers.get("x-forwarded-proto") === "https", sameSite: "lax", maxAge: 600, path: "/" });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${origin.replace(/\/$/, "")}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", prompt: "select_account" }).toString();
  return NextResponse.redirect(url);
}
