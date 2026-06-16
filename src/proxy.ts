import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let authentication endpoints, login pages, and favicon pass immediately
  if (
    pathname.startsWith("/api/auth") || 
    pathname === "/login" || 
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD;

  // If password is not configured, redirect to login (the login page will render a setup warning)
  if (!password) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(
        JSON.stringify({ error: "Setup Required: DASHBOARD_PASSWORD env var is missing." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validate the cookie token
  const token = request.cookies.get("auth_token")?.value;
  const expectedToken = await sha256(password);

  if (token === expectedToken) {
    return NextResponse.next();
  }

  // Return 401 for unauthorized API calls
  if (pathname.startsWith("/api/")) {
    return new NextResponse(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Redirect unauthorized page requests to /login
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Run middleware on all routes except static resource folders
  matcher: ["/((?!_next/static|_next/image|images|favicon.ico).*)"],
};
