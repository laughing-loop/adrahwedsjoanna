import { NextResponse } from "next/server";
import { readSessionFromRequest } from "../../../../lib/auth";

export async function GET(request) {
  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({
    authenticated: true,
    user: { email: session.email, name: session.name, role: session.role }
  });
}
