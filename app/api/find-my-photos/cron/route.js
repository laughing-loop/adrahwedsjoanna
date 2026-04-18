import { NextResponse } from "next/server";
import { runPendingFindMyPhotosMatching } from "../../../../lib/find-my-photos";

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization") || "";
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // Fallback for Vercel cron projects that haven't configured CRON_SECRET yet.
  // This is less secure than a secret because headers can be spoofed.
  const userAgent = request.headers.get("user-agent") || "";
  const vercelCronHeader = request.headers.get("x-vercel-cron") || "";
  return userAgent.startsWith("vercel-cron/") || Boolean(vercelCronHeader);
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
