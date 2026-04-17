import { NextResponse } from "next/server";
import {
  createSessionToken,
  getAuthUsers,
  getCookieOptions,
  SESSION_COOKIE_NAME,
  verifyPassword
} from "../../../../lib/auth";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalizedPassword = String(password || "");

    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = getAuthUsers().find((entry) => entry.email === normalizedEmail);
    if (!user || !verifyPassword(normalizedPassword, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const token = createSessionToken(user);
    const response = NextResponse.json({
      ok: true,
      user: { email: user.email, name: user.name, role: user.role }
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, getCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
