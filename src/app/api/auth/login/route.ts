import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { password } = body;
    const systemPassword = process.env.DASHBOARD_PASSWORD;

    if (!systemPassword) {
      return NextResponse.json(
        { error: "Authentication system is not configured. Please define DASHBOARD_PASSWORD." },
        { status: 500 }
      );
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (password === systemPassword) {
      // Create SHA-256 hash of the system password
      const hash = crypto.createHash("sha256").update(systemPassword).digest("hex");
      
      const response = NextResponse.json({ success: true });
      
      // Store the hash in a secure, HTTP-only cookie
      response.cookies.set("auth_token", hash, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week session
      });

      return response;
    }

    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  } catch (error: any) {
    console.error("Login API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
