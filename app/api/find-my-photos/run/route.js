import { NextResponse } from "next/server";
import { canUpload, readSessionFromRequest } from "../../../../lib/auth";
import { runPendingFindMyPhotosMatching } from "../../../../lib/find-my-photos";

function isCloudinaryRateLimitMessage(message) {
  return /rate limit exceeded/i.test(String(message || ""));
}

function extractRetryAt(message) {
  const match = String(message || "").match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/i);
  return match ? match[0] : null;
}

export async function POST(request) {
  try {
    const session = readSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!canUpload(session.role)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const result = await runPendingFindMyPhotosMatching();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error?.message || "Unable to run matching job.";
    if (isCloudinaryRateLimitMessage(message)) {
      const retryAt = extractRetryAt(message);
      return NextResponse.json(
        {
          error: retryAt
            ? `Cloudinary API limit reached. Try again after ${retryAt}.`
            : "Cloudinary API limit reached. Try again later.",
          retryAt
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
