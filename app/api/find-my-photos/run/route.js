import { NextResponse } from "next/server";
import { canUpload, readSessionFromRequest } from "../../../../lib/auth";
import { runPendingFindMyPhotosMatching } from "../../../../lib/find-my-photos";

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
    return NextResponse.json(
      { error: error.message || "Unable to run matching job." },
      { status: 500 }
    );
  }
}
