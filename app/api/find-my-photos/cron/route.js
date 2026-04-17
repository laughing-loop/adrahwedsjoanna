import { NextResponse } from "next/server";
import { runPendingFindMyPhotosMatching } from "../../../../lib/find-my-photos";

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runPendingFindMyPhotosMatching();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Scheduled matching failed." },
      { status: 500 }
    );
  }
}
